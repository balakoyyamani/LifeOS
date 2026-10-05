import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import { getOrCreateUser } from "../lib/lifeos";
import * as taskService from "../lib/services/task-service";

const router: IRouter = Router();
router.use(requireAuth);

// GET /tasks
router.get("/tasks", async (req, res): Promise<void> => {
  try {
    const user = await getOrCreateUser(req.userId!);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const goalId = req.query.goalId ? Number(req.query.goalId) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const tasks = await taskService.getTasks(user.id, { status, goalId, limit });
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to retrieve tasks" });
  }
});

// POST /tasks
router.post("/tasks", async (req, res): Promise<void> => {
  try {
    const user = await getOrCreateUser(req.userId!);
    const { title, description, dueDate, priority, goalId } = req.body;

    if (!title || typeof title !== "string") {
      res.status(400).json({ error: "Task title is required" });
      return;
    }

    const task = await taskService.createTask(user.id, {
      title,
      description,
      dueDate,
      priority: priority ? Number(priority) : undefined,
      goalId: goalId ? Number(goalId) : undefined,
    });
    res.status(201).json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create task" });
  }
});

// PATCH /tasks/:id
router.patch("/tasks/:id", async (req, res): Promise<void> => {
  try {
    const user = await getOrCreateUser(req.userId!);
    const taskId = Number(req.params.id);
    if (isNaN(taskId)) {
      res.status(400).json({ error: "Invalid task ID" });
      return;
    }

    const updated = await taskService.updateTask(user.id, taskId, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update task" });
  }
});

// POST /tasks/:id/complete
router.post("/tasks/:id/complete", async (req, res): Promise<void> => {
  try {
    const user = await getOrCreateUser(req.userId!);
    const taskId = Number(req.params.id);
    if (isNaN(taskId)) {
      res.status(400).json({ error: "Invalid task ID" });
      return;
    }

    const { note } = req.body || {};
    const result = await taskService.completeTask(user.id, taskId, note);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to complete task" });
  }
});

// DELETE /tasks/:id
router.delete("/tasks/:id", async (req, res): Promise<void> => {
  try {
    const user = await getOrCreateUser(req.userId!);
    const taskId = Number(req.params.id);
    if (isNaN(taskId)) {
      res.status(400).json({ error: "Invalid task ID" });
      return;
    }

    const result = await taskService.deleteTask(user.id, taskId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete task" });
  }
});

// GET /tasks/:id/notes
router.get("/tasks/:id/notes", async (req, res): Promise<void> => {
  try {
    const user = await getOrCreateUser(req.userId!);
    const taskId = Number(req.params.id);
    if (isNaN(taskId)) {
      res.status(400).json({ error: "Invalid task ID" });
      return;
    }

    const notes = await taskService.getTaskNotes(user.id, taskId);
    res.json(notes);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to get task notes" });
  }
});

// POST /tasks/:id/notes
router.post("/tasks/:id/notes", async (req, res): Promise<void> => {
  try {
    const user = await getOrCreateUser(req.userId!);
    const taskId = Number(req.params.id);
    if (isNaN(taskId)) {
      res.status(400).json({ error: "Invalid task ID" });
      return;
    }

    const { content } = req.body;
    if (!content || typeof content !== "string" || !content.trim()) {
      res.status(400).json({ error: "Note content is required" });
      return;
    }

    const note = await taskService.addTaskNote(user.id, taskId, content);
    res.status(201).json(note);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to add task note" });
  }
});

// DELETE /tasks/:taskId/notes/:noteId
router.delete("/tasks/:taskId/notes/:noteId", async (req, res): Promise<void> => {
  try {
    const user = await getOrCreateUser(req.userId!);
    const taskId = Number(req.params.taskId);
    const noteId = Number(req.params.noteId);
    if (isNaN(taskId) || isNaN(noteId)) {
      res.status(400).json({ error: "Invalid task or note ID" });
      return;
    }

    const result = await taskService.deleteTaskNote(user.id, taskId, noteId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete task note" });
  }
});

export default router;
