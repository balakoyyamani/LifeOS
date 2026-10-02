import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { schedulesTable } from "./schedules";

export const routinesTable = pgTable(
  "routines",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g. "Morning Routine", "Evening Routine"
    description: text("description"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    userRoutineIdx: index("routines_user_idx").on(table.userId),
  })
);

export const routineItemsTable = pgTable(
  "routine_items",
  {
    id: serial("id").primaryKey(),
    routineId: integer("routine_id").notNull().references(() => routinesTable.id, { onDelete: "cascade" }),
    scheduleId: integer("schedule_id").references(() => schedulesTable.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    startTime: text("start_time").notNull(), // "07:00"
    durationMinutes: integer("duration_minutes").notNull().default(30),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    routineItemIdx: index("routine_items_routine_idx").on(table.routineId),
  })
);

export const insertRoutineSchema = createInsertSchema(routinesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRoutineItemSchema = createInsertSchema(routineItemsTable).omit({ id: true, createdAt: true });
export type Routine = typeof routinesTable.$inferSelect;
export type InsertRoutine = typeof routinesTable.$inferInsert;
export type RoutineItem = typeof routineItemsTable.$inferSelect;
export type InsertRoutineItem = typeof routineItemsTable.$inferInsert;
