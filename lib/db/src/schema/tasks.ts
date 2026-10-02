import { createInsertSchema } from "drizzle-zod";
import { date, integer, pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { goalsTable } from "./goals";

export const tasksTable = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    goalId: integer("goal_id").references(() => goalsTable.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    dueDate: date("due_date", { mode: "string" }),
    priority: integer("priority").notNull().default(2), // 1: high, 2: medium, 3: low
    status: text("status").notNull().default("todo"), // "todo", "in_progress", "completed", "cancelled"
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    userTaskIdx: index("tasks_user_idx").on(table.userId),
    userStatusIdx: index("tasks_user_status_idx").on(table.userId, table.status),
  })
);

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type Task = typeof tasksTable.$inferSelect;
export type InsertTask = typeof tasksTable.$inferInsert;
