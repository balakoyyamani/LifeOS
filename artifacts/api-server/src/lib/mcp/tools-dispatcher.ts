import { getAuthenticatedContext } from "../auth-context";
import * as dashboardService from "../services/dashboard-service";
import * as goalsService from "../services/goals-service";
import * as scheduleService from "../services/schedule-service";
import * as timerService from "../services/timer-service";
import * as reminderService from "../services/reminder-service";
import * as taskService from "../services/task-service";
import * as activityService from "../services/activity-service";
import * as routineService from "../services/routine-service";
import * as careerService from "../services/career-service";
import { logger } from "../logger";

export async function dispatchMcpTool(name: string, args: any = {}) {
  const startTime = Date.now();
  let userId = 0;

  try {
    const ctx = getAuthenticatedContext();
    userId = ctx.userId;
    logger.info({ userId, toolName: name }, "Executing MCP tool call");

    let result: any;

    switch (name) {
      // --- DASHBOARD ---
      case "get_today":
        result = await dashboardService.getTodayData(userId, ctx.timezone);
        break;

      case "get_dashboard":
        result = await dashboardService.getDashboardData(userId, ctx.timezone);
        break;

      // --- GOALS ---
      case "get_goals":
        result = await goalsService.getGoals(userId, {
          status: args.status,
          search: args.search,
          limit: args.limit,
        });
        break;

      case "create_goal":
        result = await goalsService.createGoal(userId, {
          title: args.title,
          description: args.description,
          target: args.target,
          unit: args.unit,
          frequency: args.frequency,
          deadline: args.deadline,
          priority: args.priority,
          category: args.category,
        });
        break;

      case "update_goal":
        result = await goalsService.updateGoal(userId, Number(args.goal_id), {
          title: args.title,
          description: args.description,
          target: args.target,
          unit: args.unit,
          deadline: args.deadline,
          priority: args.priority,
          status: args.status,
          category: args.category,
        });
        break;

      case "delete_goal":
        result = await goalsService.deleteGoal(userId, Number(args.goal_id));
        break;

      case "update_daily_progress":
        result = await goalsService.updateDailyProgress(
          userId,
          Number(args.goal_id),
          args.date || new Date().toISOString().slice(0, 10),
          Number(args.progress),
          args.note,
        );
        break;

      case "get_progress":
        result = await goalsService.getProgress(userId, {
          goalId: args.goal_id ? Number(args.goal_id) : undefined,
          startDate: args.start_date,
          endDate: args.end_date,
        });
        break;

      // --- SCHEDULES ---
      case "create_schedule":
        result = await scheduleService.createSchedule(userId, {
          title: args.title,
          description: args.description,
          startAt: args.start_at,
          durationMinutes: args.duration_minutes ? Number(args.duration_minutes) : undefined,
          timezone: args.timezone || ctx.timezone,
          recurrence: args.recurrence,
          startDate: args.start_date,
          endDate: args.end_date,
          goalId: args.goal_id ? Number(args.goal_id) : undefined,
          taskId: args.task_id ? Number(args.task_id) : undefined,
          reminderEnabled: args.reminder_enabled,
          reminderMinutesBefore: args.reminder_minutes_before ? Number(args.reminder_minutes_before) : undefined,
        });
        break;

      case "get_schedule":
        result = await scheduleService.getSchedules(userId, {
          dateFrom: args.date_from,
          dateTo: args.date_to,
          status: args.status,
          includeCompleted: args.include_completed,
          includeRecurring: args.include_recurring,
        });
        break;

      case "update_schedule":
        result = await scheduleService.updateSchedule(userId, Number(args.schedule_id), {
          title: args.title,
          description: args.description,
          startAt: args.start_at,
          durationMinutes: args.duration_minutes ? Number(args.duration_minutes) : undefined,
          recurrence: args.recurrence,
          timezone: args.timezone,
          enabled: args.enabled,
          goalId: args.goal_id !== undefined ? (args.goal_id ? Number(args.goal_id) : null) : undefined,
          taskId: args.task_id !== undefined ? (args.task_id ? Number(args.task_id) : null) : undefined,
          reminderEnabled: args.reminder_enabled,
        });
        break;

      case "delete_schedule":
        result = await scheduleService.deleteSchedule(userId, Number(args.schedule_id));
        break;

      case "complete_schedule":
        result = await scheduleService.completeSchedule(
          userId,
          Number(args.schedule_id),
          args.occurrence_date || new Date().toISOString().slice(0, 10),
        );
        break;

      case "skip_schedule":
        result = await scheduleService.skipSchedule(
          userId,
          Number(args.schedule_id),
          args.occurrence_date || new Date().toISOString().slice(0, 10),
          args.reason,
        );
        break;

      case "get_upcoming_schedule":
        result = await scheduleService.getUpcomingSchedule(userId, {
          hours: args.hours ? Number(args.hours) : undefined,
          days: args.days ? Number(args.days) : undefined,
        });
        break;

      // --- TIMERS ---
      case "start_timer":
        result = await timerService.startTimer(userId, {
          durationMinutes: args.duration_minutes ? Number(args.duration_minutes) : undefined,
          title: args.title,
          scheduleId: args.schedule_id ? Number(args.schedule_id) : undefined,
          goalId: args.goal_id ? Number(args.goal_id) : undefined,
          taskId: args.task_id ? Number(args.task_id) : undefined,
        });
        break;

      case "get_active_timer":
        result = await timerService.getActiveTimer(userId);
        break;

      case "pause_timer":
        result = await timerService.pauseTimer(userId);
        break;

      case "resume_timer":
        result = await timerService.resumeTimer(userId);
        break;

      case "stop_timer":
        result = await timerService.stopTimer(userId);
        break;

      case "get_timer_history":
        result = await timerService.getTimerHistory(userId, {
          startDate: args.start_date,
          endDate: args.end_date,
          goalId: args.goal_id ? Number(args.goal_id) : undefined,
        });
        break;

      // --- REMINDERS ---
      case "create_reminder":
        result = await reminderService.createReminder(userId, {
          title: args.title,
          message: args.message,
          remindAt: args.remind_at,
          scheduleId: args.schedule_id ? Number(args.schedule_id) : undefined,
          goalId: args.goal_id ? Number(args.goal_id) : undefined,
        });
        break;

      case "get_reminders":
        result = await reminderService.getReminders(userId, {
          dateFrom: args.date_from,
          dateTo: args.date_to,
        });
        break;

      case "update_reminder":
        result = await reminderService.updateReminder(userId, Number(args.reminder_id), {
          title: args.title,
          message: args.message,
          remindAt: args.remind_at,
          status: args.status,
        });
        break;

      case "delete_reminder":
        result = await reminderService.deleteReminder(userId, Number(args.reminder_id));
        break;

      // --- TASKS ---
      case "get_tasks":
        result = await taskService.getTasks(userId, {
          status: args.status,
          goalId: args.goal_id ? Number(args.goal_id) : undefined,
          limit: args.limit ? Number(args.limit) : undefined,
        });
        break;

      case "create_task":
        result = await taskService.createTask(userId, {
          title: args.title,
          description: args.description,
          dueDate: args.due_date,
          priority: args.priority ? Number(args.priority) : undefined,
          goalId: args.goal_id ? Number(args.goal_id) : undefined,
        });
        break;

      case "update_task":
        result = await taskService.updateTask(userId, Number(args.task_id), {
          title: args.title,
          description: args.description,
          dueDate: args.due_date,
          priority: args.priority ? Number(args.priority) : undefined,
          status: args.status,
          goalId: args.goal_id !== undefined ? (args.goal_id ? Number(args.goal_id) : null) : undefined,
        });
        break;

      case "complete_task":
        result = await taskService.completeTask(userId, Number(args.task_id));
        break;

      case "delete_task":
        result = await taskService.deleteTask(userId, Number(args.task_id));
        break;

      // --- ACTIVITIES ---
      case "log_activity":
        result = await activityService.logActivity(userId, {
          type: args.type,
          title: args.title,
          description: args.description,
          duration: args.duration ? Number(args.duration) : undefined,
          goalId: args.goal_id ? Number(args.goal_id) : undefined,
          taskId: args.task_id ? Number(args.task_id) : undefined,
        });
        break;

      case "get_activities":
        result = await activityService.getActivities(userId, {
          startDate: args.start_date,
          endDate: args.end_date,
          type: args.type,
          limit: args.limit ? Number(args.limit) : undefined,
        });
        break;

      // --- ROUTINES ---
      case "create_routine":
        result = await routineService.createRoutine(userId, {
          name: args.name,
          description: args.description,
          items: args.items,
        });
        break;

      case "get_routines":
        result = await routineService.getRoutines(userId);
        break;

      case "update_routine":
        result = await routineService.updateRoutine(userId, Number(args.routine_id), {
          name: args.name,
          description: args.description,
          active: args.active,
        });
        break;

      case "pause_routine":
        result = await routineService.pauseRoutine(userId, Number(args.routine_id));
        break;

      case "delete_routine":
        result = await routineService.deleteRoutine(userId, Number(args.routine_id));
        break;

      // --- CAREER ---
      case "get_job_applications":
        result = await careerService.getJobApplications(userId, {
          status: args.status,
        });
        break;

      case "create_job_application":
        result = await careerService.createJobApplication(userId, {
          company: args.company,
          role: args.role,
          status: args.status,
          appliedDate: args.applied_date,
          interviewDate: args.interview_date,
          notes: args.notes,
          salary: args.salary,
          url: args.url,
        });
        break;

      case "update_job_application":
        result = await careerService.updateJobApplication(userId, Number(args.id), {
          company: args.company,
          role: args.role,
          status: args.status,
          interviewDate: args.interview_date,
          notes: args.notes,
          salary: args.salary,
          url: args.url,
        });
        break;

      case "get_interviews":
        result = await careerService.getInterviews(userId, {
          upcomingOnly: args.upcoming_only,
        });
        break;

      case "get_career_progress":
        result = await careerService.getCareerProgress(userId);
        break;

      default:
        throw new Error(`Unknown tool: "${name}"`);
    }

    const elapsedMs = Date.now() - startTime;
    logger.info({ userId, toolName: name, elapsedMs }, "MCP tool executed successfully");

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err: any) {
    const elapsedMs = Date.now() - startTime;
    logger.error({ userId, toolName: name, elapsedMs, err: err?.message }, "MCP tool execution failed");

    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: `Error executing ${name}: ${err?.message || "Unknown error"}`,
        },
      ],
    };
  }
}
