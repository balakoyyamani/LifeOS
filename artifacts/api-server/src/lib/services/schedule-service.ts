import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db, scheduleOccurrencesTable, schedulesTable, goalsTable, tasksTable } from "@workspace/db";
import { todayKey } from "../lifeos";

export interface ScheduleOccurrenceItem {
  scheduleId: number;
  title: string;
  description: string | null;
  date: string; // YYYY-MM-DD
  startAt: string; // HH:mm or ISO
  durationMinutes: number;
  timezone: string;
  status: "scheduled" | "completed" | "skipped";
  reason?: string | null;
  recurrence: string;
  goalId?: number | null;
  taskId?: number | null;
}

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

export function doesScheduleRecurOnDate(
  schedule: typeof schedulesTable.$inferSelect,
  targetDateStr: string,
): boolean {
  if (targetDateStr < schedule.startDate) return false;
  if (schedule.endDate && targetDateStr > schedule.endDate) return false;
  if (!schedule.enabled) return false;

  const rule = (schedule.recurrence || "none").trim().toLowerCase();

  if (rule === "none") {
    return targetDateStr === schedule.startDate;
  }

  if (rule === "daily") {
    return true;
  }

  const targetDate = new Date(`${targetDateStr}T12:00:00Z`);
  const dayOfWeek = targetDate.getUTCDay(); // 0 = Sun, 1 = Mon ... 6 = Sat

  if (rule === "weekdays") {
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }

  if (rule === "weekends") {
    return dayOfWeek === 0 || dayOfWeek === 6;
  }

  if (rule === "weekly") {
    const startDate = new Date(`${schedule.startDate}T12:00:00Z`);
    return dayOfWeek === startDate.getUTCDay();
  }

  if (rule.startsWith("weekly:")) {
    const daysPart = rule.slice("weekly:".length).toUpperCase().split(",");
    const targetDayName = DAY_NAMES[dayOfWeek];
    return daysPart.includes(targetDayName);
  }

  if (rule.startsWith("every_n_days:")) {
    const n = parseInt(rule.slice("every_n_days:".length), 10);
    if (isNaN(n) || n <= 0) return true;
    const startMs = new Date(`${schedule.startDate}T12:00:00Z`).getTime();
    const targetMs = targetDate.getTime();
    const diffDays = Math.round((targetMs - startMs) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays % n === 0;
  }

  if (rule === "monthly") {
    const startDate = new Date(`${schedule.startDate}T12:00:00Z`);
    return targetDate.getUTCDate() === startDate.getUTCDate();
  }

  return false;
}

export function listDatesInRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const curr = new Date(`${startDateStr}T12:00:00Z`);
  const end = new Date(`${endDateStr}T12:00:00Z`);

  while (curr <= end) {
    dates.push(curr.toISOString().slice(0, 10));
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

export async function createSchedule(
  userId: number,
  data: {
    title: string;
    description?: string;
    startAt: string;
    durationMinutes?: number;
    timezone?: string;
    recurrence?: string;
    startDate?: string;
    endDate?: string;
    goalId?: number;
    taskId?: number;
    reminderEnabled?: boolean;
    reminderMinutesBefore?: number;
  },
) {
  const startDate = data.startDate || todayKey(data.timezone || "Asia/Calcutta");
  const [created] = await db
    .insert(schedulesTable)
    .values({
      userId,
      title: data.title,
      description: data.description || null,
      startAt: data.startAt,
      durationMinutes: data.durationMinutes ?? 60,
      timezone: data.timezone || "Asia/Calcutta",
      recurrence: data.recurrence || "none",
      startDate,
      endDate: data.endDate || null,
      enabled: true,
      status: "active",
      goalId: data.goalId || null,
      taskId: data.taskId || null,
      reminderEnabled: data.reminderEnabled ?? false,
      reminderMinutesBefore: data.reminderMinutesBefore ?? 0,
    })
    .returning();

  return created;
}

export async function getSchedules(
  userId: number,
  options?: {
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    includeCompleted?: boolean;
    includeRecurring?: boolean;
  },
) {
  const userSchedules = await db
    .select()
    .from(schedulesTable)
    .where(
      and(
        eq(schedulesTable.userId, userId),
        options?.status ? eq(schedulesTable.status, options.status) : eq(schedulesTable.enabled, true),
      ),
    )
    .orderBy(asc(schedulesTable.startAt));

  const fromDate = options?.dateFrom || todayKey();
  const toDate = options?.dateTo || fromDate;

  // Fetch all occurrences in this range for user
  const occurrences = await db
    .select()
    .from(scheduleOccurrencesTable)
    .where(
      and(
        eq(scheduleOccurrencesTable.userId, userId),
        gte(scheduleOccurrencesTable.occurrenceDate, fromDate),
        lte(scheduleOccurrencesTable.occurrenceDate, toDate),
      ),
    );

  const occMap = new Map<string, typeof scheduleOccurrencesTable.$inferSelect>();
  for (const occ of occurrences) {
    occMap.set(`${occ.scheduleId}_${occ.occurrenceDate}`, occ);
  }

  const dateList = listDatesInRange(fromDate, toDate);
  const result: ScheduleOccurrenceItem[] = [];

  for (const date of dateList) {
    for (const schedule of userSchedules) {
      if (options?.includeRecurring === false && schedule.recurrence !== "none") {
        continue;
      }

      if (doesScheduleRecurOnDate(schedule, date)) {
        const occKey = `${schedule.id}_${date}`;
        const occRecord = occMap.get(occKey);

        const status = occRecord
          ? (occRecord.status as "completed" | "skipped")
          : "scheduled";

        if (options?.includeCompleted === false && status === "completed") {
          continue;
        }

        result.push({
          scheduleId: schedule.id,
          title: schedule.title,
          description: schedule.description,
          date,
          startAt: schedule.startAt,
          durationMinutes: schedule.durationMinutes,
          timezone: schedule.timezone,
          status,
          reason: occRecord?.reason || null,
          recurrence: schedule.recurrence,
          goalId: schedule.goalId,
          taskId: schedule.taskId,
        });
      }
    }
  }

  return {
    dateRange: { from: fromDate, to: toDate },
    totalOccurrences: result.length,
    occurrences: result,
    schedules: userSchedules,
  };
}

export async function updateSchedule(
  userId: number,
  scheduleId: number,
  data: {
    title?: string;
    description?: string;
    startAt?: string;
    durationMinutes?: number;
    recurrence?: string;
    timezone?: string;
    enabled?: boolean;
    goalId?: number | null;
    taskId?: number | null;
    reminderEnabled?: boolean;
  },
) {
  const updates: Partial<typeof schedulesTable.$inferInsert> = {};
  if (data.title !== undefined) updates.title = data.title;
  if (data.description !== undefined) updates.description = data.description;
  if (data.startAt !== undefined) updates.startAt = data.startAt;
  if (data.durationMinutes !== undefined) updates.durationMinutes = data.durationMinutes;
  if (data.recurrence !== undefined) updates.recurrence = data.recurrence;
  if (data.timezone !== undefined) updates.timezone = data.timezone;
  if (data.enabled !== undefined) {
    updates.enabled = data.enabled;
    updates.status = data.enabled ? "active" : "paused";
  }
  if (data.goalId !== undefined) updates.goalId = data.goalId;
  if (data.taskId !== undefined) updates.taskId = data.taskId;
  if (data.reminderEnabled !== undefined) updates.reminderEnabled = data.reminderEnabled;

  const [updated] = await db
    .update(schedulesTable)
    .set(updates)
    .where(and(eq(schedulesTable.id, scheduleId), eq(schedulesTable.userId, userId)))
    .returning();

  if (!updated) {
    throw new Error(`Schedule ${scheduleId} not found or unauthorized.`);
  }

  return updated;
}

export async function deleteSchedule(userId: number, scheduleId: number) {
  // Disables the schedule and archives it, stopping future occurrences while preserving past completion history
  const [archived] = await db
    .update(schedulesTable)
    .set({ enabled: false, status: "archived" })
    .where(and(eq(schedulesTable.id, scheduleId), eq(schedulesTable.userId, userId)))
    .returning();

  if (!archived) {
    throw new Error(`Schedule ${scheduleId} not found or unauthorized.`);
  }

  return {
    success: true,
    message: `Schedule "${archived.title}" stopped/archived. Future occurrences cancelled while historical completion data remains preserved.`,
    schedule: archived,
  };
}

export async function completeSchedule(userId: number, scheduleId: number, occurrenceDate: string) {
  // 1. Verify schedule ownership
  const [schedule] = await db
    .select()
    .from(schedulesTable)
    .where(and(eq(schedulesTable.id, scheduleId), eq(schedulesTable.userId, userId)))
    .limit(1);

  if (!schedule) {
    throw new Error(`Schedule ${scheduleId} not found or unauthorized.`);
  }

  // 2. Upsert completion occurrence
  const [occ] = await db
    .insert(scheduleOccurrencesTable)
    .values({
      scheduleId,
      userId,
      occurrenceDate,
      status: "completed",
      completedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [scheduleOccurrencesTable.scheduleId, scheduleOccurrencesTable.occurrenceDate],
      set: {
        status: "completed",
        completedAt: new Date(),
        reason: null,
      },
    })
    .returning();

  return {
    success: true,
    scheduleId,
    title: schedule.title,
    occurrenceDate,
    status: "completed",
    completedAt: occ.completedAt,
  };
}

export async function skipSchedule(
  userId: number,
  scheduleId: number,
  occurrenceDate: string,
  reason?: string,
) {
  // 1. Verify schedule ownership
  const [schedule] = await db
    .select()
    .from(schedulesTable)
    .where(and(eq(schedulesTable.id, scheduleId), eq(schedulesTable.userId, userId)))
    .limit(1);

  if (!schedule) {
    throw new Error(`Schedule ${scheduleId} not found or unauthorized.`);
  }

  // 2. Upsert skip occurrence
  const [occ] = await db
    .insert(scheduleOccurrencesTable)
    .values({
      scheduleId,
      userId,
      occurrenceDate,
      status: "skipped",
      reason: reason || "User skipped occurrence",
      completedAt: null,
    })
    .onConflictDoUpdate({
      target: [scheduleOccurrencesTable.scheduleId, scheduleOccurrencesTable.occurrenceDate],
      set: {
        status: "skipped",
        reason: reason || "User skipped occurrence",
        completedAt: null,
      },
    })
    .returning();

  return {
    success: true,
    scheduleId,
    title: schedule.title,
    occurrenceDate,
    status: "skipped",
    reason: occ.reason,
  };
}

export async function getUpcomingSchedule(
  userId: number,
  options?: { hours?: number; days?: number },
) {
  const days = options?.days ?? (options?.hours ? Math.ceil(options.hours / 24) : 3);
  const now = new Date();
  const startDateStr = now.toISOString().slice(0, 10);
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const endDateStr = future.toISOString().slice(0, 10);

  const schedulesResult = await getSchedules(userId, {
    dateFrom: startDateStr,
    dateTo: endDateStr,
    includeCompleted: false,
  });

  return {
    timeframe: `${days} days (from ${startDateStr} to ${endDateStr})`,
    upcomingCount: schedulesResult.occurrences.length,
    upcomingOccurrences: schedulesResult.occurrences,
  };
}
