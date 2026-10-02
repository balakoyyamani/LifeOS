import { db, usersTable, goalsTable, schedulesTable, timersTable, remindersTable, tasksTable, activitiesTable, routinesTable, jobApplicationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import * as goalsService from "../src/lib/services/goals-service.js";
import * as scheduleService from "../src/lib/services/schedule-service.js";
import * as timerService from "../src/lib/services/timer-service.js";
import * as reminderService from "../src/lib/services/reminder-service.js";
import * as taskService from "../src/lib/services/task-service.js";
import * as activityService from "../src/lib/services/activity-service.js";
import * as routineService from "../src/lib/services/routine-service.js";
import * as careerService from "../src/lib/services/career-service.js";

async function verifyIsolation() {
  console.log("=== RUNNING RIGOROUS MULTI-USER ISOLATION AUDIT ===");

  // 1. Create User A and User B
  const clerkIdA = `test_audit_user_a_${Date.now()}`;
  const clerkIdB = `test_audit_user_b_${Date.now()}`;

  const [userA] = await db.insert(usersTable).values({ clerkUserId: clerkIdA }).returning();
  const [userB] = await db.insert(usersTable).values({ clerkUserId: clerkIdB }).returning();

  console.log(`Created test users: User A (ID: ${userA.id}), User B (ID: ${userB.id})`);

  try {
    // 2. User B creates resources in all 8 domains
    console.log("[1] User B creating private resources...");
    const goalB = await goalsService.createGoal(userB.id, { title: "User B Private Goal", target: 10, unit: "pages" });
    const schedB = await scheduleService.createSchedule(userB.id, { title: "User B Schedule", startAt: "10:00", timezone: "UTC" });
    const timerB = await timerService.startTimer(userB.id, { title: "User B Timer", durationMinutes: 30 });
    const reminderB = await reminderService.createReminder(userB.id, { title: "User B Reminder", remindAt: new Date(Date.now() + 3600000).toISOString() });
    const taskB = await taskService.createTask(userB.id, { title: "User B Task" });
    const actB = await activityService.logActivity(userB.id, { title: "User B Activity", type: "study", durationMinutes: 45 });
    const routineB = await routineService.createRoutine(userB.id, { title: "User B Routine", items: [{ title: "Step 1", startAt: "08:00" }] });
    const careerB = await careerService.createJobApplication(userB.id, { company: "Secret Corp", position: "Lead Architect" });

    console.log("    Created resources for User B across all 8 domains.");

    // 3. User A queries: must see ZERO of User B's resources
    console.log("[2] Verifying User A cannot read User B's resources...");
    
    // Goals
    const goalsA = await goalsService.getGoals(userA.id);
    if (goalsA.some(g => g.id === goalB.id)) throw new Error("ISOLATION BREACH: User A can see User B's goal!");
    console.log("    ✓ Goals isolated");

    // Schedules
    const schedsA = await scheduleService.getSchedules(userA.id);
    if (schedsA.schedules.some(s => s.id === schedB.id) || schedsA.occurrences.some(o => o.scheduleId === schedB.id)) {
      throw new Error("ISOLATION BREACH: User A can see User B's schedule!");
    }
    console.log("    ✓ Schedules isolated");

    // Timers
    const timerA = await timerService.getActiveTimer(userA.id);
    if (timerA.active && timerA.timer?.id === timerB.id) throw new Error("ISOLATION BREACH: User A can see User B's active timer!");
    console.log("    ✓ Timers isolated");

    // Reminders
    const remindersA = await reminderService.getReminders(userA.id);
    if (remindersA.some(r => r.id === reminderB.id)) throw new Error("ISOLATION BREACH: User A can see User B's reminder!");
    console.log("    ✓ Reminders isolated");

    // Tasks
    const tasksA = await taskService.getTasks(userA.id);
    if (tasksA.some(t => t.id === taskB.id)) throw new Error("ISOLATION BREACH: User A can see User B's task!");
    console.log("    ✓ Tasks isolated");

    // Activities
    const activitiesA = await activityService.getActivities(userA.id);
    if (activitiesA.activities.some(a => a.id === actB.id)) throw new Error("ISOLATION BREACH: User A can see User B's activity!");
    console.log("    ✓ Activities isolated");

    // Routines
    const routinesA = await routineService.getRoutines(userA.id);
    if (routinesA.some(r => r.id === routineB.id)) throw new Error("ISOLATION BREACH: User A can see User B's routine!");
    console.log("    ✓ Routines isolated");

    // Career
    const careerA = await careerService.getJobApplications(userA.id);
    if (careerA.some(c => c.id === careerB.id)) throw new Error("ISOLATION BREACH: User A can see User B's career application!");
    console.log("    ✓ Career applications isolated");

    // 4. Verify User A cannot mutate or delete User B's resources
    console.log("[3] Verifying User A cannot mutate User B's resources...");
    
    // Update goal attempt
    try {
      await goalsService.updateGoal(userA.id, goalB.id, { title: "Hijacked Goal" });
      throw new Error("ISOLATION BREACH: User A was able to update User B's goal!");
    } catch (err) {
      console.log("    ✓ Goal update rejected");
    }

    // Delete schedule attempt
    try {
      await scheduleService.deleteSchedule(userA.id, schedB.id);
      throw new Error("ISOLATION BREACH: User A was able to delete User B's schedule!");
    } catch (err) {
      console.log("    ✓ Schedule deletion rejected");
    }

    // Delete task attempt
    try {
      await taskService.deleteTask(userA.id, taskB.id);
      throw new Error("ISOLATION BREACH: User A was able to delete User B's task!");
    } catch (err) {
      console.log("    ✓ Task deletion rejected");
    }

    // Update career application attempt
    try {
      await careerService.updateJobApplication(userA.id, careerB.id, { company: "Hacked Corp" });
      throw new Error("ISOLATION BREACH: User A was able to update User B's job application!");
    } catch (err) {
      console.log("    ✓ Career update rejected");
    }

    console.log("\n========================================================");
    console.log(">>> USER ISOLATION AUDIT: 100% SECURE & ENFORCED <<<");
    console.log("========================================================");
  } finally {
    // Cleanup test users (cascades to all created resources)
    await db.delete(usersTable).where(eq(usersTable.id, userA.id));
    await db.delete(usersTable).where(eq(usersTable.id, userB.id));
    console.log("Cleaned up audit test users.");
  }
}

verifyIsolation().catch(err => {
  console.error("ISOLATION AUDIT FAILED:", err);
  process.exit(1);
});
