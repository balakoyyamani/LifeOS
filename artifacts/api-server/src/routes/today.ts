import { Router, type IRouter } from "express";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db, activitiesTable, dailyGoalsTable, goalProgressTable, goalsTable } from "@workspace/db";
import {
  GetDashboardResponse,
  GetTodayResponse,
  UpdateDailyGoalProgressBody,
  UpdateDailyGoalProgressParams,
  UpdateDailyGoalProgressResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import {
  calculateMetrics,
  ensureDailyGoals,
  getDailyFocusMinutes,
  getOrCreateUser,
  listTodayGoals,
  mapDailyGoal,
  optInGoalForDate,
  optOutGoalForDate,
  recordFocusSession,
  todayKey,
} from "../lib/lifeos";

const router: IRouter = Router();
router.use(requireAuth);

async function buildToday(userId: string, targetDate?: string) {
  const user = await getOrCreateUser(userId);
  const date =
    targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)
      ? targetDate
      : todayKey(user.timezone);
  await ensureDailyGoals(user.id, date);
  const goals = (await listTodayGoals(user.id, date)).map(mapDailyGoal);
  const metrics = calculateMetrics(goals);
  return { user, date, goals, metrics };
}

router.get("/today", async (req, res): Promise<void> => {
  const dateParam = typeof req.query.date === "string" ? req.query.date : undefined;
  const { date, goals, metrics } = await buildToday(req.userId!, dateParam);
  res.json(
    GetTodayResponse.parse({
      date,
      dailyCompletion: metrics.dailyCompletion,
      dailyScore: metrics.dailyScore,
      goals,
      categoryContributions: metrics.contributions,
    }),
  );
});

router.get("/dashboard", async (req, res): Promise<void> => {
  const { user, date, goals, metrics } = await buildToday(req.userId!);
  const focusMinutes = await getDailyFocusMinutes(user.id, date);
  const unfinished = goals.filter((goal) => goal.status !== "completed" && goal.status !== "skipped");
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const isWeekend = weekday === 0 || weekday === 6;
  const highlights =
    goals.length === 0 && isWeekend
      ? ["Weekend Deload: Weekday habits resting today"]
      : unfinished.length
        ? [`${unfinished.length} goal${unfinished.length === 1 ? "" : "s"} still in motion today`]
        : ["Every goal is accounted for today"];
  res.json(
    GetDashboardResponse.parse({
      date,
      greeting: "Good morning",
      dailyCompletion: metrics.dailyCompletion,
      dailyScore: metrics.dailyScore,
      streak: metrics.completedCount > 0 ? 1 : 0,
      focusMinutes,
      completedCount: metrics.completedCount,
      totalCount: metrics.totalCount,
      categoryContributions: metrics.contributions,
      highlights,
    }),
  );
});

router.get("/history", async (req, res): Promise<void> => {
  const user = await getOrCreateUser(req.userId!);
  const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
  const endDate = typeof req.query.endDate === "string" ? req.query.endDate : undefined;

  const conditions = [eq(dailyGoalsTable.userId, user.id)];
  if (startDate) {
    conditions.push(gte(dailyGoalsTable.goalDate, startDate));
  }
  if (endDate) {
    conditions.push(lte(dailyGoalsTable.goalDate, endDate));
  }

  const rawGoals = await db
    .select({
      id: dailyGoalsTable.id,
      goalId: goalsTable.id,
      name: goalsTable.name,
      category: goalsTable.category,
      targetValue: goalsTable.targetValue,
      currentValue: goalProgressTable.currentValue,
      unit: goalsTable.unit,
      status: goalProgressTable.status,
      priority: goalsTable.priority,
      goalDate: dailyGoalsTable.goalDate,
    })
    .from(dailyGoalsTable)
    .innerJoin(goalsTable, eq(goalsTable.id, dailyGoalsTable.goalId))
    .innerJoin(goalProgressTable, eq(goalProgressTable.dailyGoalId, dailyGoalsTable.id))
    .where(and(...conditions))
    .orderBy(asc(dailyGoalsTable.goalDate), asc(goalsTable.priority));

  const byDate: Record<string, ReturnType<typeof mapDailyGoal>[]> = {};
  for (const g of rawGoals) {
    if (!byDate[g.goalDate]) byDate[g.goalDate] = [];
    byDate[g.goalDate].push(mapDailyGoal(g));
  }

  const activityConditions = [eq(activitiesTable.userId, user.id)];
  if (startDate) {
    activityConditions.push(gte(activitiesTable.activityDate, startDate));
  }
  if (endDate) {
    activityConditions.push(lte(activitiesTable.activityDate, endDate));
  }
  const rawActivities = await db
    .select({
      activityDate: activitiesTable.activityDate,
      durationMinutes: activitiesTable.durationMinutes,
      type: activitiesTable.type,
      timerId: activitiesTable.timerId,
    })
    .from(activitiesTable)
    .where(and(...activityConditions));

  const focusByDate: Record<string, number> = {};
  for (const a of rawActivities) {
    const mins = a.durationMinutes ?? 0;
    if (mins <= 0) continue;
    const t = (a.type || "").toLowerCase();
    if (t === "workout" || t === "goal_note") continue;
    if (a.timerId !== null || ["study", "focus", "deep_work", "coding"].includes(t)) {
      focusByDate[a.activityDate] = (focusByDate[a.activityDate] || 0) + mins;
    }
  }

  const history: Record<
    string,
    {
      date: string;
      dailyScore: number;
      dailyCompletion: number;
      completedCount: number;
      totalCount: number;
      focusMinutes: number;
    }
  > = {};

  for (const [d, goalsForDay] of Object.entries(byDate)) {
    const metrics = calculateMetrics(goalsForDay);
    history[d] = {
      date: d,
      dailyScore: metrics.dailyScore,
      dailyCompletion: metrics.dailyCompletion,
      completedCount: metrics.completedCount,
      totalCount: metrics.totalCount,
      focusMinutes: focusByDate[d] || 0,
    };
  }

  for (const [d, mins] of Object.entries(focusByDate)) {
    if (!history[d]) {
      history[d] = {
        date: d,
        dailyScore: 0,
        dailyCompletion: 0,
        completedCount: 0,
        totalCount: 0,
        focusMinutes: mins,
      };
    }
  }

  res.json({ history });
});

router.post("/today/focus-session", async (req, res): Promise<void> => {
  const user = await getOrCreateUser(req.userId!);
  const { durationMinutes, goalId, title, notes, taskId } = req.body ?? {};

  if (!durationMinutes || typeof durationMinutes !== "number" || durationMinutes <= 0) {
    res.status(400).json({ error: "durationMinutes must be a positive number" });
    return;
  }

  const result = await recordFocusSession(user.id, {
    durationMinutes,
    goalId: typeof goalId === "number" ? goalId : undefined,
    taskId: typeof taskId === "number" ? taskId : undefined,
    title: typeof title === "string" ? title : undefined,
    notes: typeof notes === "string" ? notes : undefined,
    dateStr: todayKey(user.timezone),
  });

  res.json(result);
});

router.patch("/today/goals/:id/progress", async (req, res): Promise<void> => {
  const params = UpdateDailyGoalProgressParams.safeParse(req.params);
  const body = UpdateDailyGoalProgressBody.safeParse(req.body);
  if (!params.success || !body.success) {
    const error = params.success ? body.error?.message ?? "Invalid request" : params.error.message;
    res.status(400).json({ error });
    return;
  }
  const user = await getOrCreateUser(req.userId!);
  const dailyGoal = await db
    .select({ id: dailyGoalsTable.id, targetValue: goalsTable.targetValue })
    .from(dailyGoalsTable)
    .innerJoin(goalsTable, eq(goalsTable.id, dailyGoalsTable.goalId))
    .where(and(eq(dailyGoalsTable.id, params.data.id), eq(dailyGoalsTable.userId, user.id)))
    .limit(1);
  if (!dailyGoal[0]) {
    res.status(404).json({ error: "Daily goal not found" });
    return;
  }

  const clampedValue = Math.max(0, Math.round(body.data.currentValue * 10) / 10);
  const targetVal = Number(dailyGoal[0].targetValue);
  const nextStatus =
    body.data.status ??
    (clampedValue >= targetVal
      ? "completed"
      : clampedValue > 0
        ? "in_progress"
        : "not_started");

  await db
    .update(goalProgressTable)
    .set({ currentValue: String(clampedValue), status: nextStatus })
    .where(eq(goalProgressTable.dailyGoalId, params.data.id));

  const updated = await listTodayGoals(user.id, todayKey(user.timezone));
  const result = updated.find((goal) => goal.id === params.data.id);
  if (!result) {
    res.status(404).json({ error: "Daily goal not found" });
    return;
  }
  res.json(UpdateDailyGoalProgressResponse.parse(mapDailyGoal(result)));
});

router.post("/today/goals/:id/opt-in", async (req, res): Promise<void> => {
  const goalId = Number(req.params.id);
  if (isNaN(goalId)) {
    res.status(400).json({ error: "Invalid goal ID" });
    return;
  }
  const user = await getOrCreateUser(req.userId!);
  const date = todayKey(user.timezone);
  const resultId = await optInGoalForDate(user.id, goalId, date);
  if (!resultId) {
    res.status(404).json({ error: "Goal not found or inactive" });
    return;
  }
  const todayGoals = (await listTodayGoals(user.id, date)).map(mapDailyGoal);
  res.json({ success: true, dailyGoalId: resultId, goals: todayGoals });
});

router.delete("/today/goals/:id/opt-in", async (req, res): Promise<void> => {
  const goalId = Number(req.params.id);
  if (isNaN(goalId)) {
    res.status(400).json({ error: "Invalid goal ID" });
    return;
  }
  const user = await getOrCreateUser(req.userId!);
  const date = todayKey(user.timezone);
  const ok = await optOutGoalForDate(user.id, goalId, date);
  if (!ok) {
    res.status(404).json({ error: "Daily goal not found for today" });
    return;
  }
  const todayGoals = (await listTodayGoals(user.id, date)).map(mapDailyGoal);
  res.json({ success: true, goals: todayGoals });
});

export default router;