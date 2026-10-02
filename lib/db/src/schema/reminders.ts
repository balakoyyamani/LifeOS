import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { goalsTable } from "./goals";
import { schedulesTable } from "./schedules";

export const remindersTable = pgTable(
  "reminders",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    message: text("message").notNull(),
    remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
    scheduleId: integer("schedule_id").references(() => schedulesTable.id, { onDelete: "set null" }),
    goalId: integer("goal_id").references(() => goalsTable.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending"), // pending, sent, dismissed, cancelled
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    userReminderIdx: index("reminders_user_idx").on(table.userId),
    remindAtIdx: index("reminders_remind_at_idx").on(table.remindAt),
  })
);

export const insertReminderSchema = createInsertSchema(remindersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type Reminder = typeof remindersTable.$inferSelect;
export type InsertReminder = typeof remindersTable.$inferInsert;
