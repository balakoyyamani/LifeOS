import {
  calculateMetrics,
  ensureDailyGoals,
  listTodayGoals,
  mapDailyGoal,
  todayKey,
} from "../lifeos";
import { getSchedules } from "./schedule-service";
import { getActiveTimer } from "./timer-service";
import { getReminders } from "./reminder-service";
import { getActivities } from "./activity-service";
import { getGoals } from "./goals-service";

export async function getTodayData(userId: number, timezone = "Asia/Calcutta") {
  const date = todayKey(timezone);

  // 1. Ensure daily goals generated for today
  await ensureDailyGoals(userId, date);
  const rawGoals = await listTodayGoals(userId, date);
  const goals = rawGoals.map(mapDailyGoal);
  const metrics = calculateMetrics(goals);

  // 2. Fetch today's schedule occurrences
  const schedulesResult = await getSchedules(userId, {
    dateFrom: date,
    dateTo: date,
    includeCompleted: true,
    includeRecurring: true,
  });

  const todaySchedules = schedulesResult.occurrences;
  const completedSchedules = todaySchedules.filter((s) => s.status === "completed");
  const skippedSchedules = todaySchedules.filter((s) => s.status === "skipped");
  const pendingSchedules = todaySchedules.filter((s) => s.status === "scheduled");

  // 3. Active timer
  const activeTimerResult = await getActiveTimer(userId);
  const activeTimer = activeTimerResult.active ? activeTimerResult : null;

  // 4. Reminders for today
  const reminders = await getReminders(userId, { dateFrom: date, dateTo: date });

  // 5. Completion Summary
  const summary = {
    goalsTotal: metrics.totalCount,
    goalsCompleted: metrics.completedCount,
    dailyCompletionPercent: metrics.dailyCompletion,
    dailyScore: metrics.dailyScore,
    scheduleItemsTotal: todaySchedules.length,
    scheduleItemsCompleted: completedSchedules.length,
    scheduleItemsPending: pendingSchedules.length,
    scheduleItemsSkipped: skippedSchedules.length,
  };

  return {
    date,
    timezone,
    summary,
    activeTimer,
    goals,
    schedule: todaySchedules,
    completedSchedules,
    skippedSchedules,
    reminders,
    categoryContributions: metrics.contributions,
  };
}

export async function getDashboardData(userId: number, timezone = "Asia/Calcutta") {
  const today = await getTodayData(userId, timezone);

  // 1. All active recurring goals
  const activeGoals = await getGoals(userId, { status: "active" });

  // 2. Upcoming schedules (next 3 days)
  const now = new Date();
  const next3DaysStr = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const upcomingSchedules = await getSchedules(userId, {
    dateFrom: today.date,
    dateTo: next3DaysStr,
    includeCompleted: false,
  });

  // 3. Recent activity (last 7 days)
  const past7DaysStr = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const recentActivities = await getActivities(userId, {
    startDate: past7DaysStr,
    limit: 10,
  });

  return {
    date: today.date,
    timezone,
    todaySummary: today.summary,
    activeTimer: today.activeTimer,
    goals: activeGoals.map((g) => ({
      id: g.id,
      name: g.name,
      category: g.category,
      targetValue: Number(g.targetValue),
      unit: g.unit,
      frequency: g.frequency,
      priority: g.priority,
    })),
    todayGoals: today.goals,
    upcomingSchedules: upcomingSchedules.occurrences.slice(0, 8),
    recentActivities: recentActivities.activities,
    weeklyProductivityMinutes: recentActivities.totalMinutes,
    productivityStats: {
      dailyScore: today.summary.dailyScore,
      dailyCompletionPercent: today.summary.dailyCompletionPercent,
      categoryBalance: today.categoryContributions,
    },
  };
}
