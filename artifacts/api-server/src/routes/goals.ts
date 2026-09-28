import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, goalsTable } from "@workspace/db";
import {
  CreateGoalBody,
  CreateGoalResponse,
  DeleteGoalParams,
  GetGoalsResponse,
  UpdateGoalBody,
  UpdateGoalParams,
  UpdateGoalResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { getOrCreateUser, listGoals } from "../lib/lifeos";

const router: IRouter = Router();
router.use(requireAuth);

function dateOnly(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return value.toISOString().slice(0, 10);
}

function mapGoal(goal: typeof goalsTable.$inferSelect) {
  return {
    id: goal.id,
    name: goal.name,
    category: goal.category,
    targetValue: Number(goal.targetValue),
    unit: goal.unit,
    frequency: goal.frequency,
    startDate: goal.startDate,
    endDate: goal.endDate,
    active: goal.active,
    priority: goal.priority,
  };
}

router.get("/goals", async (req, res): Promise<void> => {
  const user = await getOrCreateUser(req.userId!);
  const goals = await listGoals(user.id);
  res.json(GetGoalsResponse.parse(goals.map(mapGoal)));
});

router.post("/goals", async (req, res): Promise<void> => {
  const parsed = CreateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await getOrCreateUser(req.userId!);
  const [goal] = await db
    .insert(goalsTable)
    .values({
      userId: user.id,
      name: parsed.data.name,
      category: parsed.data.category,
      targetValue: String(parsed.data.targetValue),
      unit: parsed.data.unit,
      frequency: parsed.data.frequency,
      startDate: dateOnly(parsed.data.startDate)!,
      endDate: dateOnly(parsed.data.endDate),
      priority: parsed.data.priority,
      active: true,
    })
    .returning();
  res.status(201).json(CreateGoalResponse.parse(mapGoal(goal)));
});

router.patch("/goals/:id", async (req, res): Promise<void> => {
  const params = UpdateGoalParams.safeParse(req.params);
  const body = UpdateGoalBody.safeParse(req.body);
  if (!params.success || !body.success) {
    const error = params.success ? body.error?.message ?? "Invalid request" : params.error.message;
    res.status(400).json({ error });
    return;
  }
  const user = await getOrCreateUser(req.userId!);
  const updates: Partial<typeof goalsTable.$inferInsert> = {};
  if (body.data.name !== undefined) updates.name = body.data.name;
  if (body.data.category !== undefined) updates.category = body.data.category;
  if (body.data.targetValue !== undefined) updates.targetValue = String(body.data.targetValue);
  if (body.data.unit !== undefined) updates.unit = body.data.unit;
  if (body.data.frequency !== undefined) updates.frequency = body.data.frequency;
  if (body.data.startDate !== undefined) updates.startDate = dateOnly(body.data.startDate)!;
  if (body.data.endDate !== undefined) updates.endDate = dateOnly(body.data.endDate);
  if (body.data.active !== undefined) updates.active = body.data.active;
  if (body.data.priority !== undefined) updates.priority = body.data.priority;

  const [goal] = await db
    .update(goalsTable)
    .set(updates)
    .where(and(eq(goalsTable.id, params.data.id), eq(goalsTable.userId, user.id)))
    .returning();
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  res.json(UpdateGoalResponse.parse(mapGoal(goal)));
});

router.delete("/goals/:id", async (req, res): Promise<void> => {
  const params = DeleteGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const user = await getOrCreateUser(req.userId!);
  const [goal] = await db
    .delete(goalsTable)
    .where(and(eq(goalsTable.id, params.data.id), eq(goalsTable.userId, user.id)))
    .returning({ id: goalsTable.id });
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;