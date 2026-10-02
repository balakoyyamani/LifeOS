import { createInsertSchema } from "drizzle-zod";
import { date, integer, jsonb, pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { goalsTable } from "./goals";
import { tasksTable } from "./tasks";
import { timersTable } from "./timers";

export const activitiesTable = pgTable(
  "activities",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("general"), // study, coding, workout, reading, application, task, general
    title: text("title").notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes").default(0),
    goalId: integer("goal_id").references(() => goalsTable.id, { onDelete: "set null" }),
    taskId: integer("task_id").references(() => tasksTable.id, { onDelete: "set null" }),
    timerId: integer("timer_id").references(() => timersTable.id, { onDelete: "set null" }),
    activityDate: date("activity_date", { mode: "string" }).notNull(),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userActivityIdx: index("activities_user_idx").on(table.userId),
    userDateIdx: index("activities_user_date_idx").on(table.userId, table.activityDate),
  })
);

export const insertActivitySchema = createInsertSchema(activitiesTable).omit({ id: true, createdAt: true });
export type Activity = typeof activitiesTable.$inferSelect;
export type InsertActivity = typeof activitiesTable.$inferInsert;
