import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { goalsTable } from "./goals";
import { schedulesTable } from "./schedules";
import { tasksTable } from "./tasks";

export const timersTable = pgTable(
  "timers",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    scheduleId: integer("schedule_id").references(() => schedulesTable.id, { onDelete: "set null" }),
    goalId: integer("goal_id").references(() => goalsTable.id, { onDelete: "set null" }),
    taskId: integer("task_id").references(() => tasksTable.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    accumulatedSeconds: integer("accumulated_seconds").notNull().default(0),
    targetDurationSeconds: integer("target_duration_seconds").notNull().default(0),
    status: text("status").notNull().default("running"), // "running", "paused", "completed", "stopped", "cancelled"
    completedAt: timestamp("completed_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    userTimerIdx: index("timers_user_idx").on(table.userId),
    userStatusIdx: index("timers_user_status_idx").on(table.userId, table.status),
  })
);

export const insertTimerSchema = createInsertSchema(timersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type Timer = typeof timersTable.$inferSelect;
export type InsertTimer = typeof timersTable.$inferInsert;
