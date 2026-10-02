import { and, desc, eq, gte } from "drizzle-orm";
import { db, jobApplicationsTable, goalsTable, activitiesTable } from "@workspace/db";
import { todayKey } from "../lifeos";

export async function getJobApplications(userId: number, options?: { status?: string }) {
  const conditions = [eq(jobApplicationsTable.userId, userId)];

  if (options?.status) {
    conditions.push(eq(jobApplicationsTable.status, options.status));
  }

  const list = await db
    .select()
    .from(jobApplicationsTable)
    .where(and(...conditions))
    .orderBy(desc(jobApplicationsTable.createdAt));

  return list;
}

export async function createJobApplication(
  userId: number,
  data: {
    company: string;
    role?: string;
    position?: string;
    status?: string;
    appliedDate?: string;
    interviewDate?: string;
    notes?: string;
    salary?: string;
    url?: string;
  },
) {
  const appliedDate = data.appliedDate || todayKey();

  const [created] = await db
    .insert(jobApplicationsTable)
    .values({
      userId,
      company: data.company,
      role: data.role || data.position || "Candidate",
      status: data.status || "applied",
      appliedDate,
      interviewDate: data.interviewDate ? new Date(data.interviewDate) : null,
      notes: data.notes || null,
      salary: data.salary || null,
      url: data.url || null,
    })
    .returning();

  // Also log to activities
  await db.insert(activitiesTable).values({
    userId,
    type: "application",
    title: `Applied to ${data.company} - ${data.role}`,
    description: data.notes || null,
    durationMinutes: 15,
    activityDate: appliedDate,
  });

  return created;
}

export async function updateJobApplication(
  userId: number,
  id: number,
  data: {
    company?: string;
    role?: string;
    status?: string;
    interviewDate?: string | null;
    notes?: string;
    salary?: string;
    url?: string;
  },
) {
  const updates: Partial<typeof jobApplicationsTable.$inferInsert> = {};
  if (data.company !== undefined) updates.company = data.company;
  if (data.role !== undefined) updates.role = data.role;
  if (data.status !== undefined) updates.status = data.status;
  if (data.interviewDate !== undefined) {
    updates.interviewDate = data.interviewDate ? new Date(data.interviewDate) : null;
  }
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.salary !== undefined) updates.salary = data.salary;
  if (data.url !== undefined) updates.url = data.url;

  const [updated] = await db
    .update(jobApplicationsTable)
    .set(updates)
    .where(and(eq(jobApplicationsTable.id, id), eq(jobApplicationsTable.userId, userId)))
    .returning();

  if (!updated) {
    throw new Error(`Job application ${id} not found or unauthorized.`);
  }

  return updated;
}

export async function getInterviews(userId: number, options?: { upcomingOnly?: boolean }) {
  const conditions = [eq(jobApplicationsTable.userId, userId)];

  if (options?.upcomingOnly) {
    conditions.push(gte(jobApplicationsTable.interviewDate, new Date()));
  }

  const list = await db
    .select()
    .from(jobApplicationsTable)
    .where(and(...conditions))
    .orderBy(desc(jobApplicationsTable.interviewDate));

  return list.filter((item) => item.interviewDate !== null);
}

export async function getCareerProgress(userId: number) {
  const all = await db
    .select()
    .from(jobApplicationsTable)
    .where(eq(jobApplicationsTable.userId, userId));

  const total = all.length;
  const applied = all.filter((a) => a.status === "applied").length;
  const interviewing = all.filter((a) => a.status === "interviewing").length;
  const offered = all.filter((a) => a.status === "offered").length;
  const rejected = all.filter((a) => a.status === "rejected").length;

  // Find career goal target if exists
  const careerGoals = await db
    .select()
    .from(goalsTable)
    .where(and(eq(goalsTable.userId, userId), eq(goalsTable.category, "career"), eq(goalsTable.active, true)));

  return {
    totalApplications: total,
    byStatus: {
      applied,
      interviewing,
      offered,
      rejected,
    },
    interviewRatePercent: total > 0 ? Math.round((interviewing / total) * 100) : 0,
    offerRatePercent: total > 0 ? Math.round((offered / total) * 100) : 0,
    activeCareerGoals: careerGoals.map((g) => ({
      id: g.id,
      name: g.name,
      targetValue: Number(g.targetValue),
      unit: g.unit,
    })),
  };
}
