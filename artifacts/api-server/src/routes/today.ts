import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
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
  todayKey,
} from "../lib/lifeos";

const router: IRouter = Router();
router.use(requireAuth);

async function buildToday(userId: string) {
  const user = await getOrCreateUser(userId);
  const date = todayKey(user.timezone);
  await ensureDailyGoals(user.id, date);
  const goals = (await listTodayGoals(user.id, date)).map(mapDailyGoal);
  const metrics = calculateMetrics(goals);
  return { user, date, goals, metrics };
}

router.get("/today", async (req, res): Promise<void> => {
  const { date, goals, metrics } = await buildToday(req.userId!);
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
  const highlights = unfinished.length
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

export default router;