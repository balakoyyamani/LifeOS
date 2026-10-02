import { and, asc, desc, eq } from "drizzle-orm";
import { db, tasksTable, goalsTable } from "@workspace/db";

export async function getTasks(
  userId: number,
  options?: { status?: string; goalId?: number; limit?: number },
) {
  const conditions = [eq(tasksTable.userId, userId)];

  if (options?.status) {
    conditions.push(eq(tasksTable.status, options.status));
  }
  if (options?.goalId) {
    conditions.push(eq(tasksTable.goalId, options.goalId));
  }

  const query = db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      description: tasksTable.description,
      dueDate: tasksTable.dueDate,
      priority: tasksTable.priority,
      status: tasksTable.status,
      completedAt: tasksTable.completedAt,
      goalId: tasksTable.goalId,
      goalName: goalsTable.name,
      createdAt: tasksTable.createdAt,
    })
    .from(tasksTable)
    .leftJoin(goalsTable, eq(goalsTable.id, tasksTable.goalId))
    .where(and(...conditions))
    .orderBy(asc(tasksTable.priority), asc(tasksTable.dueDate));

  return options?.limit ? query.limit(options.limit) : query;
}

export async function createTask(
  userId: number,
  data: {
    title: string;
    description?: string;
    dueDate?: string;
    priority?: number;
    goalId?: number;
  },
) {
  if (data.goalId) {
    const [goal] = await db
      .select({ id: goalsTable.id })
      .from(goalsTable)
      .where(and(eq(goalsTable.id, data.goalId), eq(goalsTable.userId, userId)))
      .limit(1);
    if (!goal) {
      throw new Error(`Goal ${data.goalId} not found or unauthorized.`);
    }
  }

  const [task] = await db
    .insert(tasksTable)
    .values({
      userId,
      title: data.title,
      description: data.description || null,
      dueDate: data.dueDate || null,
      priority: data.priority ?? 2,
      goalId: data.goalId || null,
      status: "todo",
    })
    .returning();

  return task;
}

export async function updateTask(
  userId: number,
  taskId: number,
  data: {
    title?: string;
    description?: string;
    dueDate?: string;
    priority?: number;
    status?: string;
    goalId?: number | null;
  },
) {
  const updates: Partial<typeof tasksTable.$inferInsert> = {};
  if (data.title !== undefined) updates.title = data.title;
  if (data.description !== undefined) updates.description = data.description;
  if (data.dueDate !== undefined) updates.dueDate = data.dueDate;
  if (data.priority !== undefined) updates.priority = data.priority;
  if (data.status !== undefined) {
    updates.status = data.status;
    if (data.status === "completed") {
      updates.completedAt = new Date();
    }
  }
  if (data.goalId !== undefined) updates.goalId = data.goalId;

  const [updated] = await db
    .update(tasksTable)
    .set(updates)
    .where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, userId)))
    .returning();

  if (!updated) {
    throw new Error(`Task ${taskId} not found or unauthorized.`);
  }

  return updated;
}

export async function completeTask(userId: number, taskId: number) {
  const [task] = await db
    .update(tasksTable)
    .set({ status: "completed", completedAt: new Date() })
    .where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, userId)))
    .returning();

  if (!task) {
    throw new Error(`Task ${taskId} not found or unauthorized.`);
  }

  return { success: true, task };
}

export async function deleteTask(userId: number, taskId: number) {
  const [deleted] = await db
    .delete(tasksTable)
    .where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, userId)))
    .returning({ id: tasksTable.id, title: tasksTable.title });

  if (!deleted) {
    throw new Error(`Task ${taskId} not found or unauthorized.`);
  }

  return { success: true, message: `Task "${deleted.title}" deleted.` };
}
