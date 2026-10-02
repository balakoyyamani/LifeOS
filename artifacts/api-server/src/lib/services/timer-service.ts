import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import {
  db,
  timersTable,
  goalsTable,
  schedulesTable,
  tasksTable,
  activitiesTable,
  dailyGoalsTable,
  goalProgressTable,
} from "@workspace/db";
import { todayKey } from "../lifeos";

export async function startTimer(
  userId: number,
  data: {
    durationMinutes?: number;
    title?: string;
    scheduleId?: number;
    goalId?: number;
    taskId?: number;
  },
) {
  // 1. If any active timer exists for this user, pause or stop it cleanly
  const existingActive = await db
    .select()
    .from(timersTable)
    .where(and(eq(timersTable.userId, userId), inArray(timersTable.status, ["running", "paused"])));

  for (const t of existingActive) {
    let finalElapsed = t.accumulatedSeconds;
    if (t.status === "running") {
      finalElapsed += Math.max(0, Math.floor((Date.now() - t.startedAt.getTime()) / 1000));
    }
    await db
      .update(timersTable)
      .set({
        status: "stopped",
        accumulatedSeconds: finalElapsed,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(timersTable.id, t.id));
  }

  // 2. Resolve default title if not provided
  let title = data.title;
  if (!title && data.goalId) {
    const [goal] = await db
      .select({ name: goalsTable.name })
      .from(goalsTable)
      .where(and(eq(goalsTable.id, data.goalId), eq(goalsTable.userId, userId)))
      .limit(1);
    if (goal) title = `Focus: ${goal.name}`;
  }
  if (!title && data.scheduleId) {
    const [sched] = await db
      .select({ title: schedulesTable.title })
      .from(schedulesTable)
      .where(and(eq(schedulesTable.id, data.scheduleId), eq(schedulesTable.userId, userId)))
      .limit(1);
    if (sched) title = sched.title;
  }
  if (!title) {
    title = "Focus Session";
  }

  const durationMins = data.durationMinutes ?? 25;
  const targetDurationSeconds = durationMins * 60;
  const now = new Date();

  // 3. Create new running timer
  const [timer] = await db
    .insert(timersTable)
    .values({
      userId,
      title,
      scheduleId: data.scheduleId || null,
      goalId: data.goalId || null,
      taskId: data.taskId || null,
      startedAt: now,
      accumulatedSeconds: 0,
      targetDurationSeconds,
      status: "running",
    })
    .returning();

  return {
    timerId: timer.id,
    title: timer.title,
    status: timer.status,
    startedAt: timer.startedAt.toISOString(),
    targetDurationSeconds,
    targetDurationMinutes: durationMins,
    elapsedSeconds: 0,
    remainingSeconds: targetDurationSeconds,
    goalId: timer.goalId,
    scheduleId: timer.scheduleId,
  };
}

export async function getActiveTimer(userId: number) {
  const [timer] = await db
    .select({
      id: timersTable.id,
      title: timersTable.title,
      status: timersTable.status,
      startedAt: timersTable.startedAt,
      pausedAt: timersTable.pausedAt,
      accumulatedSeconds: timersTable.accumulatedSeconds,
      targetDurationSeconds: timersTable.targetDurationSeconds,
      goalId: timersTable.goalId,
      scheduleId: timersTable.scheduleId,
      taskId: timersTable.taskId,
      goalName: goalsTable.name,
      scheduleTitle: schedulesTable.title,
    })
    .from(timersTable)
    .leftJoin(goalsTable, eq(goalsTable.id, timersTable.goalId))
    .leftJoin(schedulesTable, eq(schedulesTable.id, timersTable.scheduleId))
    .where(and(eq(timersTable.userId, userId), inArray(timersTable.status, ["running", "paused"])))
    .limit(1);

  if (!timer) {
    return {
      active: false,
      message: "No active timer session running.",
      timer: null,
    };
  }

  const nowMs = Date.now();
  let elapsed = timer.accumulatedSeconds;
  if (timer.status === "running") {
    elapsed += Math.max(0, Math.floor((nowMs - timer.startedAt.getTime()) / 1000));
  }
  const remaining = Math.max(0, timer.targetDurationSeconds - elapsed);

  return {
    active: true,
    timerId: timer.id,
    title: timer.title,
    status: timer.status,
    startedAt: timer.startedAt.toISOString(),
    pausedAt: timer.pausedAt ? timer.pausedAt.toISOString() : null,
    elapsedSeconds: elapsed,
    elapsedMinutes: Math.floor(elapsed / 60),
    remainingSeconds: remaining,
    remainingMinutes: Math.ceil(remaining / 60),
    targetDurationSeconds: timer.targetDurationSeconds,
    targetDurationMinutes: Math.round(timer.targetDurationSeconds / 60),
    linkedGoal: timer.goalId ? { id: timer.goalId, name: timer.goalName } : null,
    linkedSchedule: timer.scheduleId ? { id: timer.scheduleId, title: timer.scheduleTitle } : null,
    linkedTaskId: timer.taskId,
  };
}

export async function pauseTimer(userId: number) {
  const [timer] = await db
    .select()
    .from(timersTable)
    .where(and(eq(timersTable.userId, userId), eq(timersTable.status, "running")))
    .limit(1);

  if (!timer) {
    throw new Error("No running timer found to pause.");
  }

  const now = new Date();
  const addedSeconds = Math.max(0, Math.floor((now.getTime() - timer.startedAt.getTime()) / 1000));
  const newAccumulated = timer.accumulatedSeconds + addedSeconds;

  const [updated] = await db
    .update(timersTable)
    .set({
      status: "paused",
      pausedAt: now,
      accumulatedSeconds: newAccumulated,
      updatedAt: now,
    })
    .where(eq(timersTable.id, timer.id))
    .returning();

  const remaining = Math.max(0, updated.targetDurationSeconds - newAccumulated);

  return {
    success: true,
    timerId: updated.id,
    title: updated.title,
    status: "paused",
    accumulatedSeconds: newAccumulated,
    elapsedMinutes: Math.floor(newAccumulated / 60),
    remainingSeconds: remaining,
  };
}

export async function resumeTimer(userId: number) {
  const [timer] = await db
    .select()
    .from(timersTable)
    .where(and(eq(timersTable.userId, userId), eq(timersTable.status, "paused")))
    .limit(1);

  if (!timer) {
    throw new Error("No paused timer found to resume.");
  }

  const now = new Date();
  const [updated] = await db
    .update(timersTable)
    .set({
      status: "running",
      startedAt: now,
      pausedAt: null,
      updatedAt: now,
    })
    .where(eq(timersTable.id, timer.id))
    .returning();

  const remaining = Math.max(0, updated.targetDurationSeconds - updated.accumulatedSeconds);

  return {
    success: true,
    timerId: updated.id,
    title: updated.title,
    status: "running",
    accumulatedSeconds: updated.accumulatedSeconds,
    remainingSeconds: remaining,
  };
}

export async function stopTimer(userId: number) {
  const [timer] = await db
    .select()
    .from(timersTable)
    .where(and(eq(timersTable.userId, userId), inArray(timersTable.status, ["running", "paused"])))
    .limit(1);

  if (!timer) {
    throw new Error("No active timer found to stop.");
  }

  const now = new Date();
  let totalElapsed = timer.accumulatedSeconds;
  if (timer.status === "running") {
    totalElapsed += Math.max(0, Math.floor((now.getTime() - timer.startedAt.getTime()) / 1000));
  }

  const isCompleted = timer.targetDurationSeconds > 0 && totalElapsed >= timer.targetDurationSeconds;
  const finalStatus = isCompleted ? "completed" : "stopped";

  const [updated] = await db
    .update(timersTable)
    .set({
      status: finalStatus,
      accumulatedSeconds: totalElapsed,
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(timersTable.id, timer.id))
    .returning();

  const durationMinutes = Math.round(totalElapsed / 60);

  // 1. Log to activities table
  await db.insert(activitiesTable).values({
    userId,
    type: "study",
    title: updated.title,
    description: `Timer session ended. Total duration: ${durationMinutes} minutes.`,
    durationMinutes,
    goalId: updated.goalId,
    taskId: updated.taskId,
    timerId: updated.id,
    activityDate: now.toISOString().slice(0, 10),
  });

  // 2. If linked to a goal with minutes unit, update progress today
  if (updated.goalId && durationMinutes > 0) {
    try {
      const todayStr = todayKey();
      const [dailyGoal] = await db
        .select({ id: dailyGoalsTable.id })
        .from(dailyGoalsTable)
        .where(
          and(
            eq(dailyGoalsTable.userId, userId),
            eq(dailyGoalsTable.goalId, updated.goalId),
            eq(dailyGoalsTable.goalDate, todayStr),
          ),
        )
        .limit(1);

      if (dailyGoal) {
        const [progress] = await db
          .select()
          .from(goalProgressTable)
          .where(eq(goalProgressTable.dailyGoalId, dailyGoal.id))
          .limit(1);

        if (progress) {
          const cur = Number(progress.currentValue) + durationMinutes;
          await db
            .update(goalProgressTable)
            .set({ currentValue: String(cur), status: "in_progress", updatedAt: new Date() })
            .where(eq(goalProgressTable.id, progress.id));
        }
      }
    } catch {
      // Don't fail stopTimer if progress increment fails
    }
  }

  return {
    success: true,
    timerId: updated.id,
    title: updated.title,
    status: finalStatus,
    actualDurationSeconds: totalElapsed,
    actualDurationMinutes: durationMinutes,
    targetDurationSeconds: updated.targetDurationSeconds,
    stoppedAt: now.toISOString(),
  };
}

export async function getTimerHistory(
  userId: number,
  options?: { startDate?: string; endDate?: string; goalId?: number; limit?: number },
) {
  const conditions = [
    eq(timersTable.userId, userId),
    inArray(timersTable.status, ["completed", "stopped"]),
  ];

  if (options?.goalId) {
    conditions.push(eq(timersTable.goalId, options.goalId));
  }
  if (options?.startDate) {
    conditions.push(gte(timersTable.createdAt, new Date(`${options.startDate}T00:00:00Z`)));
  }
  if (options?.endDate) {
    conditions.push(lte(timersTable.createdAt, new Date(`${options.endDate}T23:59:59Z`)));
  }

  const query = db
    .select({
      id: timersTable.id,
      title: timersTable.title,
      status: timersTable.status,
      startedAt: timersTable.startedAt,
      completedAt: timersTable.completedAt,
      accumulatedSeconds: timersTable.accumulatedSeconds,
      targetDurationSeconds: timersTable.targetDurationSeconds,
      goalId: timersTable.goalId,
      goalName: goalsTable.name,
      scheduleId: timersTable.scheduleId,
    })
    .from(timersTable)
    .leftJoin(goalsTable, eq(goalsTable.id, timersTable.goalId))
    .where(and(...conditions))
    .orderBy(desc(timersTable.createdAt));

  const list = await (options?.limit ? query.limit(options.limit) : query);

  return {
    totalSessions: list.length,
    totalMinutes: Math.round(
      list.reduce((sum, item) => sum + (item.accumulatedSeconds || 0), 0) / 60,
    ),
    sessions: list.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      durationMinutes: Math.round((s.accumulatedSeconds || 0) / 60),
      durationSeconds: s.accumulatedSeconds,
      targetMinutes: Math.round((s.targetDurationSeconds || 0) / 60),
      startedAt: s.startedAt?.toISOString(),
      completedAt: s.completedAt?.toISOString(),
      goal: s.goalId ? { id: s.goalId, name: s.goalName } : null,
    })),
  };
}
