import { createInsertSchema } from "drizzle-zod";
import { date, integer, pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const jobApplicationsTable = pgTable(
  "job_applications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    company: text("company").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull().default("applied"), // bookmarked, applied, interviewing, offered, rejected, withdrawn
    appliedDate: date("applied_date", { mode: "string" }),
    interviewDate: timestamp("interview_date", { withTimezone: true }),
    notes: text("notes"),
    salary: text("salary"),
    url: text("url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    userJobAppIdx: index("job_applications_user_idx").on(table.userId),
    statusIdx: index("job_applications_status_idx").on(table.status),
  })
);

export const insertJobApplicationSchema = createInsertSchema(jobApplicationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type JobApplication = typeof jobApplicationsTable.$inferSelect;
export type InsertJobApplication = typeof jobApplicationsTable.$inferInsert;
