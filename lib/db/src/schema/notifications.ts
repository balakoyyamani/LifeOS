import { boolean, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const pushSubscriptionsTable = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    endpointIdx: uniqueIndex("push_subscriptions_endpoint_idx").on(table.endpoint),
    userIdIdx: uniqueIndex("push_subscriptions_user_endpoint_idx").on(table.userId, table.endpoint),
  }),
);

export const userRemindersConfigTable = pgTable(
  "user_reminders_config",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    morningKickoffEnabled: boolean("morning_kickoff_enabled").notNull().default(true),
    morningKickoffTime: text("morning_kickoff_time").notNull().default("08:30"),
    eveningReflectionEnabled: boolean("evening_reflection_enabled").notNull().default(true),
    eveningReflectionTime: text("evening_reflection_time").notNull().default("21:00"),
    goalRemindersEnabled: boolean("goal_reminders_enabled").notNull().default(true),
    goalSchedules: jsonb("goal_schedules").default({}),
    timezone: text("timezone").notNull().default("Asia/Calcutta"),
    lastMorningNotifiedDate: text("last_morning_notified_date"),
    lastEveningNotifiedDate: text("last_evening_notified_date"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    userRemindersUserIdx: uniqueIndex("user_reminders_config_user_idx").on(table.userId),
  }),
);

export type PushSubscriptionRecord = typeof pushSubscriptionsTable.$inferSelect;
export type UserRemindersConfig = typeof userRemindersConfigTable.$inferSelect;
