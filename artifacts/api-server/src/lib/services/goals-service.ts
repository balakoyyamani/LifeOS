import { and, asc, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { db, dailyGoalsTable, goalProgressTable, goalsTable } from "@workspace/db";
import { Category, categories } from "../lifeos";

export interface GetGoalsFilter {
  status?: "active" | "inactive" | "all";
  limit?: number;
  search?: string;
}

export async function getGoals(userId: number, filters?: GetGoalsFilter) {
  const conditions = [eq(goalsTable.userId, userId)];

  if (filters?.status === "active") {
    conditions.push(eq(goalsTable.active, true));
  } else if (filters?.status === "inactive") {
    conditions.push(eq(goalsTable.active, false));
  }

  if (filters?.search) {
    conditions.push(ilike(goalsTable.name, `%${filters.search}%`));
  }

  let query = db
    .select()
    .from(goalsTable)
    .where(and(...conditions))
    .orderBy(asc(goalsTable.priority), asc(goalsTable.createdAt));

  if (filters?.limit && filters.limit > 0) {
    return query.limit(filters.limit);
  }

  return query;
}

export async function createGoal(
  userId: number,
  data: {
    title: string;
    description?: string;
    target?: number | string;
    unit?: string;
    frequency?: string;
    deadline?: string;
    priority?: number;
    category?: string;
  },
) {
  const targetValue = String(data.target ?? 1);
  const unit = data.unit || "units";
  const frequency = data.frequency || "daily";
  const priority = data.priority ?? 2;
  const category = (categories.includes(data.category as any) ? data.category : "personal") as Category;
  const startDate = new Date().toISOString().slice(0, 10);
  const endDate = data.deadline || null;

  const [created] = await db
    .insert(goalsTable)
    .values({
      userId,
      name: data.title,
      category,
      targetValue,
      unit,
      frequency,
      startDate,
      endDate,
      priority,
      active: true,
    })
    .returning();

  return created;
}

export async function updateGoal(
  userId: number,
  goalId: number,
  data: {
    title?: string;
    description?: string;
    target?: number | string;
    unit?: string;
    deadline?: string | null;
    priority?: number;
    status?: "active" | "inactive" | boolean;
    category?: string;
  },
) {
  const updates: Partial<typeof goalsTable.$inferInsert> = {};
  if (data.title !== undefined) updates.name = data.title;
  if (data.target !== undefined) updates.targetValue = String(data.target);
  if (data.unit !== undefined) updates.unit = data.unit;
  if (data.deadline !== undefined) updates.endDate = data.deadline;
  if (data.priority !== undefined) updates.priority = data.priority;
  if (data.category !== undefined && categories.includes(data.category as any)) {
    updates.category = data.category;
  }
  if (data.status !== undefined) {
    if (typeof data.status === "boolean") {
      updates.active = data.status;
    } else {
      updates.active = data.status === "active";
    }
  }

  const [updated] = await db
    .update(goalsTable)
    .set(updates)
    .where(and(eq(goalsTable.id, goalId), eq(goalsTable.userId, userId)))
    .returning();

  if (!updated) {
    throw new Error(`Goal with ID ${goalId} not found or not owned by user.`);
  }

  return updated;
}

export async function deleteGoal(userId: number, goalId: number) {
  // Soft delete preferred: set active = false
  const [updated] = await db
    .update(goalsTable)
    .set({ active: false })
    .where(and(eq(goalsTable.id, goalId), eq(goalsTable.userId, userId)))
    .returning({ id: goalsTable.id, name: goalsTable.name, active: goalsTable.active });

  if (!updated) {
    throw new Error(`Goal with ID ${goalId} not found or not owned by user.`);
  }

  return { success: true, message: `Goal "${updated.name}" deactivated (soft deleted).`, goal: updated };
}

export async function updateDailyProgress(
  userId: number,
  goalId: number,
  date: string,
  progress: number,
  note?: string,
) {
  // 1. Verify goal ownership
  const [goal] = await db
    .select()
    .from(goalsTable)
    .where(and(eq(goalsTable.id, goalId), eq(goalsTable.userId, userId)))
    .limit(1);

  if (!goal) {
    throw new Error(`Goal with ID ${goalId} not found or not owned by user.`);
  }

  // 2. Ensure daily goal record exists
  let [dailyGoal] = await db
    .select()
    .from(dailyGoalsTable)
    .where(
      and(
        eq(dailyGoalsTable.userId, userId),
        eq(dailyGoalsTable.goalId, goalId),
        eq(dailyGoalsTable.goalDate, date),
      ),
    )
    .limit(1);

  if (!dailyGoal) {
    const [created] = await db
      .insert(dailyGoalsTable)
      .values({ userId, goalId, goalDate: date })
      .returning();
    dailyGoal = created;
    await db.insert(goalProgressTable).values({ dailyGoalId: dailyGoal.id, currentValue: "0" });
  }

  // 3. Update progress
  const targetVal = Number(goal.targetValue);
  const clampedVal = Math.max(0, Math.round(progress * 100) / 100);
  const status = clampedVal >= targetVal ? "completed" : clampedVal > 0 ? "in_progress" : "not_started";

  const [updatedProgress] = await db
    .insert(goalProgressTable)
    .values({
      dailyGoalId: dailyGoal.id,
      currentValue: String(clampedVal),
      status,
    })
    .onConflictDoUpdate({
      target: goalProgressTable.dailyGoalId,
      set: {
        currentValue: String(clampedVal),
        status,
        updatedAt: new Date(),
      },
    })
    .returning();

  return {
    goalId: goal.id,
    goalName: goal.name,
    date,
    currentValue: Number(updatedProgress.currentValue),
    targetValue: targetVal,
    unit: goal.unit,
    status: updatedProgress.status,
    percent: targetVal > 0 ? Math.min(100, Math.round((clampedVal / targetVal) * 100)) : 100,
    note,
  };
}

export async function getProgress(
  userId: number,
  filters?: { goalId?: number; startDate?: string; endDate?: string },
) {
  const conditions = [eq(dailyGoalsTable.userId, userId)];

  if (filters?.goalId) {
    conditions.push(eq(dailyGoalsTable.goalId, filters.goalId));
  }
  if (filters?.startDate) {
    conditions.push(gte(dailyGoalsTable.goalDate, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(dailyGoalsTable.goalDate, filters.endDate));
  }

  const records = await db
    .select({
      dailyGoalId: dailyGoalsTable.id,
      goalId: goalsTable.id,
      goalName: goalsTable.name,
      category: goalsTable.category,
      unit: goalsTable.unit,
      targetValue: goalsTable.targetValue,
      currentValue: goalProgressTable.currentValue,
      status: goalProgressTable.status,
      date: dailyGoalsTable.goalDate,
    })
    .from(dailyGoalsTable)
    .innerJoin(goalsTable, eq(goalsTable.id, dailyGoalsTable.goalId))
    .innerJoin(goalProgressTable, eq(goalProgressTable.dailyGoalId, dailyGoalsTable.id))
    .where(and(...conditions))
    .orderBy(desc(dailyGoalsTable.goalDate), asc(goalsTable.priority));

  const total = records.length;
  const completed = records.filter(
    (r) => r.status === "completed" || Number(r.currentValue) >= Number(r.targetValue),
  ).length;

  return {
    summary: {
      totalDailyGoals: total,
      completedCount: completed,
      completionRatePercent: total > 0 ? Math.round((completed / total) * 100) : 0,
    },
    history: records.map((r) => {
      const cur = Number(r.currentValue);
      const tar = Number(r.targetValue);
      return {
        date: r.date,
        goalId: r.goalId,
        goalName: r.goalName,
        category: r.category,
        currentValue: cur,
        targetValue: tar,
        unit: r.unit,
        status: r.status,
        percent: tar > 0 ? Math.min(100, Math.round((cur / tar) * 100)) : 100,
      };
    }),
  };
}
