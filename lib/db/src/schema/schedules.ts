import { createInsertSchema } from "drizzle-zod";
import { boolean, date, integer, pgTable, serial, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { goalsTable } from "./goals";
import { tasksTable } from "./tasks";

export const schedulesTable = pgTable(
  "schedules",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    startAt: text("start_at").notNull(), // "18:00" (HH:mm 24-hr format) or ISO time string
    durationMinutes: integer("duration_minutes").notNull().default(60),
    timezone: text("timezone").notNull().default("Asia/Calcutta"),
    recurrence: text("recurrence").notNull().default("none"), // "none", "daily", "weekdays", "weekends", "weekly", "weekly:MON,WED,FRI", etc.
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    enabled: boolean("enabled").notNull().default(true),
    status: text("status").notNull().default("active"), // "active", "paused", "archived"
    goalId: integer("goal_id").references(() => goalsTable.id, { onDelete: "set null" }),
    taskId: integer("task_id").references(() => tasksTable.id, { onDelete: "set null" }),
    reminderEnabled: boolean("reminder_enabled").notNull().default(false),
    reminderMinutesBefore: integer("reminder_minutes_before").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    userScheduleIdx: index("schedules_user_idx").on(table.userId),
    startDateIdx: index("schedules_start_date_idx").on(table.startDate),
  })
);

export const scheduleOccurrencesTable = pgTable(
  "schedule_occurrences",
  {
    id: serial("id").primaryKey(),
    scheduleId: integer("schedule_id").notNull().references(() => schedulesTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    occurrenceDate: date("occurrence_date", { mode: "string" }).notNull(),
    status: text("status").notNull().default("completed"), // "completed", "skipped"
    reason: text("reason"),
    completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    scheduleOccurrenceUniqueIdx: uniqueIndex("schedule_occurrences_unique_idx").on(table.scheduleId, table.occurrenceDate),
    userOccurrenceIdx: index("schedule_occurrences_user_date_idx").on(table.userId, table.occurrenceDate),
  })
);

export const insertScheduleSchema = createInsertSchema(schedulesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type Schedule = typeof schedulesTable.$inferSelect;
export type InsertSchedule = typeof schedulesTable.$inferInsert;
export type ScheduleOccurrence = typeof scheduleOccurrencesTable.$inferSelect;
export type InsertScheduleOccurrence = typeof scheduleOccurrencesTable.$inferInsert;
