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
