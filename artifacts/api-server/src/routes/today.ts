import { Router, type IRouter } from "express";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db, dailyGoalsTable, goalProgressTable } from "@workspace/db";
import { goalsTable } from "@workspace/db";
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
  getOrCreateUser,
  listTodayGoals,
  mapDailyGoal,
  optInGoalForDate,
  optOutGoalForDate,
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
  const { date, goals, metrics } = await buildToday(req.userId!);
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
      focusMinutes: 0,
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

  const history: Record<
    string,
    {
      date: string;
      dailyScore: number;
      dailyCompletion: number;
      completedCount: number;
      totalCount: number;
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
    };
  }

  res.json({ history });
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