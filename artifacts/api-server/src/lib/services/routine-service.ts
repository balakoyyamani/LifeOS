import { and, asc, eq } from "drizzle-orm";
import { db, routinesTable, routineItemsTable, schedulesTable } from "@workspace/db";

export async function createRoutine(
  userId: number,
  data: {
    name?: string;
    title?: string;
    description?: string;
    items?: Array<{
      title: string;
      startTime?: string;
      startAt?: string;
      durationMinutes?: number;
      scheduleId?: number;
    }>;
  },
) {
  const [routine] = await db
    .insert(routinesTable)
    .values({
      userId,
      name: data.name || data.title || "Routine",
      description: data.description || null,
      active: true,
    })
    .returning();

  const createdItems = [];
  if (data.items && data.items.length > 0) {
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      const [ritem] = await db
        .insert(routineItemsTable)
        .values({
          routineId: routine.id,
          title: item.title,
          startTime: item.startTime || item.startAt || "08:00",
          durationMinutes: item.durationMinutes ?? 30,
          scheduleId: item.scheduleId || null,
          orderIndex: i,
        })
        .returning();
      createdItems.push(ritem);
    }
  }

  return {
    ...routine,
    items: createdItems,
  };
}

export async function getRoutines(userId: number) {
  const routines = await db
    .select()
    .from(routinesTable)
    .where(eq(routinesTable.userId, userId))
    .orderBy(asc(routinesTable.createdAt));

  const result = [];
  for (const r of routines) {
    const items = await db
      .select()
      .from(routineItemsTable)
      .where(eq(routineItemsTable.routineId, r.id))
      .orderBy(asc(routineItemsTable.orderIndex));
    result.push({
      ...r,
      items,
    });
  }

  return result;
}

export async function updateRoutine(
  userId: number,
  routineId: number,
  data: {
    name?: string;
    description?: string;
    active?: boolean;
  },
) {
  const updates: Partial<typeof routinesTable.$inferInsert> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.active !== undefined) updates.active = data.active;

  const [updated] = await db
    .update(routinesTable)
    .set(updates)
    .where(and(eq(routinesTable.id, routineId), eq(routinesTable.userId, userId)))
    .returning();

  if (!updated) {
    throw new Error(`Routine ${routineId} not found or unauthorized.`);
  }

  return updated;
}

export async function pauseRoutine(userId: number, routineId: number) {
  const [updated] = await db
    .update(routinesTable)
    .set({ active: false })
    .where(and(eq(routinesTable.id, routineId), eq(routinesTable.userId, userId)))
    .returning();

  if (!updated) {
    throw new Error(`Routine ${routineId} not found or unauthorized.`);
  }

  return { success: true, message: `Routine "${updated.name}" paused.`, routine: updated };
}

export async function deleteRoutine(userId: number, routineId: number) {
  const [deleted] = await db
    .delete(routinesTable)
    .where(and(eq(routinesTable.id, routineId), eq(routinesTable.userId, userId)))
    .returning({ id: routinesTable.id, name: routinesTable.name });

  if (!deleted) {
    throw new Error(`Routine ${routineId} not found or unauthorized.`);
  }

  return { success: true, message: `Routine "${deleted.name}" deleted.` };
}
