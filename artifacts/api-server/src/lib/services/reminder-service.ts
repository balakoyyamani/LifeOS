import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db, remindersTable, goalsTable, schedulesTable } from "@workspace/db";

export async function createReminder(
  userId: number,
  data: {
    title: string;
    message: string;
    remindAt: string | Date;
    scheduleId?: number;
    goalId?: number;
  },
) {
  const remindAtDate = typeof data.remindAt === "string" ? new Date(data.remindAt) : data.remindAt;

  if (isNaN(remindAtDate.getTime())) {
    throw new Error("Invalid remindAt timestamp provided.");
  }

  const [reminder] = await db
    .insert(remindersTable)
    .values({
      userId,
      title: data.title,
      message: data.message || data.title,
      remindAt: remindAtDate,
      scheduleId: data.scheduleId || null,
      goalId: data.goalId || null,
      status: "pending",
    })
    .returning();

  return reminder;
}

export async function getReminders(
  userId: number,
  options?: { dateFrom?: string; dateTo?: string; status?: string },
) {
  const conditions = [eq(remindersTable.userId, userId)];

  if (options?.status) {
    conditions.push(eq(remindersTable.status, options.status));
  }
  if (options?.dateFrom) {
    conditions.push(gte(remindersTable.remindAt, new Date(`${options.dateFrom}T00:00:00Z`)));
  }
  if (options?.dateTo) {
    conditions.push(lte(remindersTable.remindAt, new Date(`${options.dateTo}T23:59:59Z`)));
  }

  const list = await db
    .select({
      id: remindersTable.id,
      title: remindersTable.title,
      message: remindersTable.message,
      remindAt: remindersTable.remindAt,
      status: remindersTable.status,
      scheduleId: remindersTable.scheduleId,
      scheduleTitle: schedulesTable.title,
      goalId: remindersTable.goalId,
      goalName: goalsTable.name,
      createdAt: remindersTable.createdAt,
    })
    .from(remindersTable)
    .leftJoin(schedulesTable, eq(schedulesTable.id, remindersTable.scheduleId))
    .leftJoin(goalsTable, eq(goalsTable.id, remindersTable.goalId))
    .where(and(...conditions))
    .orderBy(asc(remindersTable.remindAt));

  return list.map((r) => ({
    id: r.id,
    title: r.title,
    message: r.message,
    remindAt: r.remindAt.toISOString(),
    status: r.status,
    schedule: r.scheduleId ? { id: r.scheduleId, title: r.scheduleTitle } : null,
    goal: r.goalId ? { id: r.goalId, name: r.goalName } : null,
  }));
}

export async function updateReminder(
  userId: number,
  reminderId: number,
  data: {
    title?: string;
    message?: string;
    remindAt?: string | Date;
    status?: string;
  },
) {
  const updates: Partial<typeof remindersTable.$inferInsert> = {};
  if (data.title !== undefined) updates.title = data.title;
  if (data.message !== undefined) updates.message = data.message;
  if (data.remindAt !== undefined) {
    const d = typeof data.remindAt === "string" ? new Date(data.remindAt) : data.remindAt;
    if (isNaN(d.getTime())) throw new Error("Invalid remindAt timestamp.");
    updates.remindAt = d;
  }
  if (data.status !== undefined) updates.status = data.status;

  const [updated] = await db
    .update(remindersTable)
    .set(updates)
    .where(and(eq(remindersTable.id, reminderId), eq(remindersTable.userId, userId)))
    .returning();

  if (!updated) {
    throw new Error(`Reminder ${reminderId} not found or unauthorized.`);
  }

  return updated;
}

export async function deleteReminder(userId: number, reminderId: number) {
  const [deleted] = await db
    .delete(remindersTable)
    .where(and(eq(remindersTable.id, reminderId), eq(remindersTable.userId, userId)))
    .returning({ id: remindersTable.id, title: remindersTable.title });

  if (!deleted) {
    throw new Error(`Reminder ${reminderId} not found or unauthorized.`);
  }

  return { success: true, message: `Reminder "${deleted.title}" deleted.` };
}
