import { and, asc, eq, gte, isNull, lte, or } from "drizzle-orm";
import {
  db,
  dailyGoalsTable,
  goalProgressTable,
  goalsTable,
  profilesTable,
  usersTable,
} from "@workspace/db";

export const categories = ["career", "learning", "health", "mind", "routine", "personal"] as const;
export type Category = (typeof categories)[number];
export const categoryWeights: Record<Category, number> = {
  career: 0.3,
  learning: 0.25,
  health: 0.2,
  mind: 0.1,
  routine: 0.15,
  personal: 0,
};

const starterGoals = [
  { name: "Job applications", category: "career", targetValue: "100", unit: "applications", priority: 1 },
  { name: "Focused study", category: "learning", targetValue: "60", unit: "minutes", priority: 1 },
  { name: "Technology learning", category: "learning", targetValue: "120", unit: "minutes", priority: 2 },
  { name: "Reading", category: "mind", targetValue: "30", unit: "minutes", priority: 2 },
  { name: "Cardio", category: "health", targetValue: "30", unit: "minutes", priority: 2 },
  { name: "Core workout", category: "health", targetValue: "30", unit: "minutes", priority: 3 },
] as const;

export function todayKey(timeZone = "Asia/Calcutta"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toNumber(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

export async function getOrCreateUser(clerkUserId: string): Promise<{ id: number; timezone: string }> {
  const existing = await db
    .select({ id: usersTable.id, timezone: profilesTable.timezone })
    .from(usersTable)
    .leftJoin(profilesTable, eq(profilesTable.userId, usersTable.id))
    .where(eq(usersTable.clerkUserId, clerkUserId))
    .limit(1);

  if (existing[0]) {
    return { id: existing[0].id, timezone: existing[0].timezone ?? "Asia/Calcutta" };
  }

  try {
    const [user] = await db
      .insert(usersTable)
      .values({ clerkUserId })
      .onConflictDoNothing({ target: usersTable.clerkUserId })
      .returning({ id: usersTable.id });

    if (!user) {
      // Concurrently created by a parallel request, re-fetch
      const created = await db
        .select({ id: usersTable.id, timezone: profilesTable.timezone })
        .from(usersTable)
        .leftJoin(profilesTable, eq(profilesTable.userId, usersTable.id))
        .where(eq(usersTable.clerkUserId, clerkUserId))
        .limit(1);
      return { id: created[0].id, timezone: created[0]?.timezone ?? "Asia/Calcutta" };
    }

    await db.insert(profilesTable).values({ userId: user.id });

    const startDate = todayKey();
    await db.insert(goalsTable).values(
      starterGoals.map((goal) => ({
        userId: user.id,
        ...goal,
        frequency: "daily",
        startDate,
        active: true,
      })),
    );

    return { id: user.id, timezone: "Asia/Calcutta" };
  } catch (_err) {
    const fallback = await db
      .select({ id: usersTable.id, timezone: profilesTable.timezone })
      .from(usersTable)
      .leftJoin(profilesTable, eq(profilesTable.userId, usersTable.id))
      .where(eq(usersTable.clerkUserId, clerkUserId))
      .limit(1);
    if (fallback[0]) {
      return { id: fallback[0].id, timezone: fallback[0].timezone ?? "Asia/Calcutta" };
    }
    throw _err;
  }
}

export async function ensureDailyGoals(userId: number, dateKey: string): Promise<void> {
  const activeGoals = await db
    .select()
    .from(goalsTable)
    .where(
      and(
        eq(goalsTable.userId, userId),
        eq(goalsTable.active, true),
        lte(goalsTable.startDate, dateKey),
        orEndDate(dateKey),
      ),
    )
    .orderBy(asc(goalsTable.priority), asc(goalsTable.createdAt));

  const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  for (const goal of activeGoals) {
    if (goal.frequency === "weekdays" && (weekday === 0 || weekday === 6)) continue;
    if (goal.frequency === "weekly" && weekday !== 1) continue;
    const existing = await db
      .select({ id: dailyGoalsTable.id })
      .from(dailyGoalsTable)
      .where(
        and(
          eq(dailyGoalsTable.userId, userId),
          eq(dailyGoalsTable.goalId, goal.id),
          eq(dailyGoalsTable.goalDate, dateKey),
        ),
      )
      .limit(1);

    if (existing[0]) continue;
    const [dailyGoal] = await db
      .insert(dailyGoalsTable)
      .values({ userId, goalId: goal.id, goalDate: dateKey })
      .returning({ id: dailyGoalsTable.id });
    await db.insert(goalProgressTable).values({ dailyGoalId: dailyGoal.id });
  }
}

function orEndDate(dateKey: string) {
  return or(isNull(goalsTable.endDate), gte(goalsTable.endDate, dateKey));
}

export async function listTodayGoals(userId: number, dateKey: string) {
  return db
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
    })
    .from(dailyGoalsTable)
    .innerJoin(goalsTable, eq(goalsTable.id, dailyGoalsTable.goalId))
    .innerJoin(goalProgressTable, eq(goalProgressTable.dailyGoalId, dailyGoalsTable.id))
    .where(and(eq(dailyGoalsTable.userId, userId), eq(dailyGoalsTable.goalDate, dateKey)))
    .orderBy(asc(goalsTable.priority), asc(goalsTable.createdAt));
}

export function mapDailyGoal(goal: Awaited<ReturnType<typeof listTodayGoals>>[number]) {
  const targetValue = toNumber(goal.targetValue);
  const currentValue = toNumber(goal.currentValue);
  const percent = goal.status === "skipped" ? 0 : Math.min(100, Math.round((currentValue / targetValue) * 100));
  return {
    id: goal.id,
    goalId: goal.goalId,
    name: goal.name,
    category: goal.category as Category,
    targetValue,
    currentValue,
    unit: goal.unit,
    status: goal.status as "not_started" | "in_progress" | "completed" | "skipped",
    percent,
    priority: goal.priority,
  };
}

export function calculateMetrics(goals: ReturnType<typeof mapDailyGoal>[]) {
  const totalCount = goals.length;
  const completedCount = goals.filter((goal) => goal.status === "completed" || goal.percent >= 100).length;
  const dailyCompletion = totalCount ? Math.round(goals.reduce((sum, goal) => sum + goal.percent, 0) / totalCount) : 0;
  const contributions = categories.map((category) => {
    const group = goals.filter((goal) => goal.category === category);
    const completion = group.length
      ? Math.round(group.reduce((sum, goal) => sum + goal.percent, 0) / group.length)
      : 0;
    return {
      category,
      weight: categoryWeights[category],
      completion,
      contribution: Math.round((completion / 100) * categoryWeights[category] * 100),
    };
  });
  const dailyScore = contributions.reduce((sum, item) => sum + item.contribution, 0);
  return { dailyCompletion, dailyScore, completedCount, totalCount, contributions };
}

export async function listGoals(userId: number) {
  return db.select().from(goalsTable).where(eq(goalsTable.userId, userId)).orderBy(asc(goalsTable.priority), asc(goalsTable.createdAt));
}