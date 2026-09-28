import { createInsertSchema } from "drizzle-zod";
import { date, integer, numeric, pgTable, serial, text, timestamp, uniqueIndex, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { z } from "zod/v4";

export const goalsTable = pgTable("goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  targetValue: numeric("target_value", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  frequency: text("frequency").notNull().default("daily"),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }),
  active: boolean("active").notNull().default(true),
  priority: integer("priority").notNull().default(2),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const dailyGoalsTable = pgTable(
  "daily_goals",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    goalId: integer("goal_id").notNull().references(() => goalsTable.id, { onDelete: "cascade" }),
    goalDate: date("goal_date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    dailyGoalIdx: uniqueIndex("daily_goals_user_goal_date_idx").on(table.userId, table.goalId, table.goalDate),
  }),
);

export const goalProgressTable = pgTable("goal_progress", {
  id: serial("id").primaryKey(),
  dailyGoalId: integer("daily_goal_id").notNull().references(() => dailyGoalsTable.id, { onDelete: "cascade" }),
  currentValue: numeric("current_value", { precision: 10, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("not_started"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  dailyGoalProgressIdx: uniqueIndex("goal_progress_daily_goal_idx").on(table.dailyGoalId),
}));

export const insertGoalSchema = createInsertSchema(goalsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goalsTable.$inferSelect;
export type DailyGoal = typeof dailyGoalsTable.$inferSelect;
export type GoalProgress = typeof goalProgressTable.$inferSelect;