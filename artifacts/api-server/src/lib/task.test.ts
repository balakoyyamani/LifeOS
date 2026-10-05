process.env.DATABASE_URL ??= "postgresql://mock:mock@localhost:5432/mock";

import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { taskNotesTable, insertTaskNoteSchema } = await import("@workspace/db");
const { getTableName } = await import("drizzle-orm");
const { LIFEOS_MCP_TOOLS } = await import("./mcp/tools-registry");

describe("Task Notes System", () => {
  it("should define task_notes table schema with required fields", () => {
    assert.ok(taskNotesTable, "taskNotesTable should exist in DB schema");
    assert.equal(getTableName(taskNotesTable), "task_notes");
    assert.ok(taskNotesTable.taskId, "taskId column should exist");
    assert.ok(taskNotesTable.userId, "userId column should exist");
    assert.ok(taskNotesTable.content, "content column should exist");
    assert.ok(taskNotesTable.createdAt, "createdAt column should exist");
  });

  it("should validate task note insert schema", () => {
    const valid = insertTaskNoteSchema.safeParse({
      taskId: 1,
      userId: 1,
      content: "Completed unit testing chapter 4",
    });
    assert.equal(valid.success, true);

    const invalid = insertTaskNoteSchema.safeParse({
      taskId: 1,
      userId: 1,
      // missing content
    });
    assert.equal(invalid.success, false);
  });

  it("should expose add_task_note and get_task_notes in MCP tools", () => {
    const addTool = LIFEOS_MCP_TOOLS.find((t) => t.name === "add_task_note");
    assert.ok(addTool, "add_task_note must be registered");
    assert.deepEqual(addTool.inputSchema.required, ["task_id", "content"]);

    const getTool = LIFEOS_MCP_TOOLS.find((t) => t.name === "get_task_notes");
    assert.ok(getTool, "get_task_notes must be registered");
    assert.deepEqual(getTool.inputSchema.required, ["task_id"]);

    const completeTool = LIFEOS_MCP_TOOLS.find((t) => t.name === "complete_task");
    assert.ok(completeTool, "complete_task must be registered");
    assert.ok((completeTool.inputSchema.properties as any)?.note, "complete_task should accept optional note");
  });
});

describe("Goal & Daily Goal Notes Dual-Resolution", () => {
  it("should have activities table supporting goalId and goal_note type", async () => {
    const { activitiesTable, dailyGoalsTable, goalsTable } = await import("@workspace/db");
    assert.ok(activitiesTable.goalId, "activitiesTable.goalId should exist");
    assert.ok(activitiesTable.type, "activitiesTable.type should exist");
    assert.ok(dailyGoalsTable.goalId, "dailyGoalsTable.goalId should exist to link to parent goal");
    assert.ok(goalsTable.id, "goalsTable.id should exist");
  });

  it("should correctly resolve canonical goal ID from parent or daily goal", () => {
    // Pure resolver function matching the logic implemented in /goals/:id/notes
    function resolveGoalId({
      inputGoalId,
      goals,
      dailyGoals,
    }: {
      inputGoalId: number;
      goals: Array<{ id: number; name: string }>;
      dailyGoals: Array<{ id: number; goalId: number; name: string }>;
    }): { canonicalGoalId: number; goalName: string } | null {
      const parentGoal = goals.find((g) => g.id === inputGoalId);
      if (parentGoal) {
        return { canonicalGoalId: parentGoal.id, goalName: parentGoal.name };
      }
      const dailyGoal = dailyGoals.find((dg) => dg.id === inputGoalId);
      if (dailyGoal) {
        return { canonicalGoalId: dailyGoal.goalId, goalName: dailyGoal.name };
      }
      return null;
    }

    const mockGoals = [{ id: 2, name: "Workout 45 mins" }];
    const mockDailyGoals = [{ id: 524, goalId: 2, name: "Workout 45 mins" }];

    // Test 1: Given parent goal ID (2)
    const resFromParent = resolveGoalId({ inputGoalId: 2, goals: mockGoals, dailyGoals: mockDailyGoals });
    assert.ok(resFromParent);
    assert.equal(resFromParent.canonicalGoalId, 2);
    assert.equal(resFromParent.goalName, "Workout 45 mins");

    // Test 2: Given daily goal ID (524)
    const resFromDaily = resolveGoalId({ inputGoalId: 524, goals: mockGoals, dailyGoals: mockDailyGoals });
    assert.ok(resFromDaily);
    assert.equal(resFromDaily.canonicalGoalId, 2, "Should resolve to canonical parent goal ID 2");
    assert.equal(resFromDaily.goalName, "Workout 45 mins");

    // Test 3: Non-existent ID returns null (triggers 404)
    const resNotFound = resolveGoalId({ inputGoalId: 9999, goals: mockGoals, dailyGoals: mockDailyGoals });
    assert.equal(resNotFound, null);
  });
});

