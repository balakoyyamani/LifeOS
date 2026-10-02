import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db, activitiesTable, goalsTable, tasksTable } from "@workspace/db";
import { todayKey } from "../lifeos";

export async function logActivity(
  userId: number,
  data: {
    type: string;
    title: string;
    description?: string;
    duration?: number;
    goalId?: number;
    taskId?: number;
    activityDate?: string;
  },
) {
  const dateStr = data.activityDate || todayKey();

  const [activity] = await db
    .insert(activitiesTable)
    .values({
      userId,
      type: data.type || "general",
      title: data.title,
      description: data.description || null,
      durationMinutes: data.duration ?? 0,
      goalId: data.goalId || null,
      taskId: data.taskId || null,
      activityDate: dateStr,
    })
    .returning();

  return activity;
}

export async function getActivities(
  userId: number,
  options?: { startDate?: string; endDate?: string; type?: string; limit?: number },
) {
  const conditions = [eq(activitiesTable.userId, userId)];

  if (options?.type) {
    conditions.push(eq(activitiesTable.type, options.type));
  }
  if (options?.startDate) {
    conditions.push(gte(activitiesTable.activityDate, options.startDate));
  }
  if (options?.endDate) {
    conditions.push(lte(activitiesTable.activityDate, options.endDate));
  }

  const query = db
    .select({
      id: activitiesTable.id,
      type: activitiesTable.type,
      title: activitiesTable.title,
      description: activitiesTable.description,
      durationMinutes: activitiesTable.durationMinutes,
      activityDate: activitiesTable.activityDate,
      goalId: activitiesTable.goalId,
      goalName: goalsTable.name,
      taskId: activitiesTable.taskId,
      taskTitle: tasksTable.title,
      createdAt: activitiesTable.createdAt,
    })
    .from(activitiesTable)
    .leftJoin(goalsTable, eq(goalsTable.id, activitiesTable.goalId))
    .leftJoin(tasksTable, eq(tasksTable.id, activitiesTable.taskId))
    .where(and(...conditions))
    .orderBy(desc(activitiesTable.activityDate), desc(activitiesTable.createdAt));

  const list = await (options?.limit ? query.limit(options.limit) : query);

  const totalMinutes = list.reduce((sum, item) => sum + (item.durationMinutes || 0), 0);

  return {
    totalCount: list.length,
    totalMinutes,
    activities: list,
  };
}
