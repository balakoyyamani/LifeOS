import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const LIFEOS_MCP_TOOLS: Tool[] = [
  // --- DASHBOARD ---
  {
    name: "get_today",
    description:
      "Get today's complete daily execution view for LifeOS. Returns today's active goals, daily progress percentages, category contributions, today's schedule items (including recurring schedule occurrences), completion status, active focus timer, and today's reminders. Use when the user asks 'Show my day', 'What do I have today?', or 'Show today's LifeOS view'.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_dashboard",
    description:
      "Get high-level LifeOS productivity dashboard. Returns active recurring goals, today's completion rate and score, weekly productivity minutes, upcoming schedule items for the next 3 days, recent activities, and category balance. Use when the user asks 'Show my dashboard' or 'How am I doing overall?'.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },

  // --- GOALS ---
  {
    name: "get_goals",
    description:
      "Retrieve the authenticated user's recurring goals in LifeOS. Supports filtering by status ('active', 'inactive', 'all'), keyword search, and limit. Use when the user asks 'What are my goals?' or 'List my active goals'.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["active", "inactive", "all"],
          description: "Filter goals by active status (default: 'active')",
        },
        search: {
          type: "string",
          description: "Optional keyword to search goal names",
        },
        limit: {
          type: "number",
          description: "Maximum number of goals to return",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_goal",
    description:
      "Create a new recurring goal for the authenticated user in LifeOS. Parameters: title (name of goal), category ('career', 'learning', 'health', 'mind', 'routine', 'personal'), target value, unit (e.g. 'minutes', 'applications', 'pages'), frequency ('daily', 'weekdays', 'weekly'), optional deadline (YYYY-MM-DD), and priority (1=highest, 2=medium, 3=low).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Name or title of the goal" },
        description: { type: "string", description: "Optional description or context for the goal" },
        target: { type: "number", description: "Target value (e.g. 60 for 60 minutes, 10 for 10 applications)" },
        unit: { type: "string", description: "Unit of measurement (e.g. 'minutes', 'apps', 'pages')" },
        frequency: {
          type: "string",
          enum: ["daily", "weekdays", "weekly"],
          description: "Goal recurrence frequency (default: 'daily')",
        },
        deadline: { type: "string", description: "Optional deadline or end date in YYYY-MM-DD format" },
        priority: { type: "number", description: "Priority level: 1 (high), 2 (medium), 3 (low)" },
        category: {
          type: "string",
          enum: ["career", "learning", "health", "mind", "routine", "personal"],
          description: "LifeOS category for the goal",
        },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "update_goal",
    description:
      "Update an existing goal owned by the authenticated user in LifeOS. Verify ownership and update title, target, unit, deadline, priority, status ('active' or 'inactive'), or category.",
    inputSchema: {
      type: "object",
      properties: {
        goal_id: { type: "number", description: "Unique ID of the goal to update" },
        title: { type: "string", description: "Updated goal title" },
        description: { type: "string", description: "Updated goal description" },
        target: { type: "number", description: "Updated target value" },
        unit: { type: "string", description: "Updated unit of measurement" },
        deadline: { type: "string", description: "Updated deadline (YYYY-MM-DD) or empty to remove" },
        priority: { type: "number", description: "Updated priority (1, 2, or 3)" },
        status: { type: "string", enum: ["active", "inactive"], description: "Activate or deactivate goal" },
        category: {
          type: "string",
          enum: ["career", "learning", "health", "mind", "routine", "personal"],
          description: "Updated category",
        },
      },
      required: ["goal_id"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_goal",
    description:
      "Soft-deletes or archives an existing goal owned by the authenticated user in LifeOS so historical progress is preserved.",
    inputSchema: {
      type: "object",
      properties: {
        goal_id: { type: "number", description: "Unique ID of the goal to delete/archive" },
      },
      required: ["goal_id"],
      additionalProperties: false,
    },
  },
  {
    name: "update_daily_progress",
    description:
      "Log or update measurable daily progress for a goal on a specific date (defaults to today). Example: 45 minutes of Java study. Clamps appropriately and updates daily completion score.",
    inputSchema: {
      type: "object",
      properties: {
        goal_id: { type: "number", description: "Unique ID of the goal" },
        date: { type: "string", description: "Target date in YYYY-MM-DD format (defaults to today)" },
        progress: { type: "number", description: "Current achieved progress value (e.g. 45 for 45 minutes)" },
        note: { type: "string", description: "Optional journal or reflection note" },
      },
      required: ["goal_id", "progress"],
      additionalProperties: false,
    },
  },
  {
    name: "get_progress",
    description:
      "Retrieve historical goal progress analytics across a date range or for a specific goal. Returns daily completion logs, summary stats, and completion rate.",
    inputSchema: {
      type: "object",
      properties: {
        goal_id: { type: "number", description: "Optional goal ID filter" },
        start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
        end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
      },
      additionalProperties: false,
    },
  },

  // --- SCHEDULES ---
  {
    name: "create_schedule",
    description:
      "Schedule something that should happen at a specific time (one-time or recurring). Examples: 'Study Java tomorrow at 6 PM for 2 hours', 'Apply for jobs every weekday at 9 AM', 'Practice coding every Monday, Wednesday, and Friday'. Recurrence values: 'none' (one-time), 'daily', 'weekdays', 'weekends', 'weekly', 'weekly:MON,WED,FRI', 'every_n_days:N', 'monthly'.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title of the scheduled activity (e.g. 'Java Study')" },
        description: { type: "string", description: "Optional description or agenda" },
        start_at: { type: "string", description: "Start time in HH:mm 24-hr format (e.g. '18:00') or ISO datetime" },
        duration_minutes: { type: "number", description: "Duration in minutes (default: 60)" },
        timezone: { type: "string", description: "IANA Timezone (defaults to user's timezone, e.g. 'Asia/Calcutta')" },
        recurrence: {
          type: "string",
          description:
            "Recurrence pattern: 'none', 'daily', 'weekdays', 'weekends', 'weekly', 'weekly:MON,WED,FRI', 'every_n_days:2', 'monthly'",
        },
        start_date: { type: "string", description: "Date the schedule begins (YYYY-MM-DD, defaults to today)" },
        end_date: { type: "string", description: "Optional end date (YYYY-MM-DD)" },
        goal_id: { type: "number", description: "Optional linked LifeOS goal ID" },
        task_id: { type: "number", description: "Optional linked LifeOS task ID" },
        reminder_enabled: { type: "boolean", description: "Whether to notify the user before the schedule" },
        reminder_minutes_before: { type: "number", description: "Minutes before start_at to send notification" },
      },
      required: ["title", "start_at"],
      additionalProperties: false,
    },
  },
  {
    name: "get_schedule",
    description:
      "Retrieve the authenticated user's schedules and dynamically calculated occurrences within a date range (default: today). Returns title, start time, duration, status ('scheduled', 'completed', 'skipped'), recurrence, and linked goal.",
    inputSchema: {
      type: "object",
      properties: {
        date_from: { type: "string", description: "Start date in YYYY-MM-DD format (default: today)" },
        date_to: { type: "string", description: "End date in YYYY-MM-DD format (default: date_from)" },
        status: { type: "string", description: "Filter by status: 'active', 'paused', 'archived'" },
        include_completed: { type: "boolean", description: "Whether to include completed occurrences (default: true)" },
        include_recurring: { type: "boolean", description: "Whether to include recurring schedules (default: true)" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "update_schedule",
    description:
      "Update a schedule owned by the authenticated user in LifeOS. Verify ownership and update title, start time, duration, recurrence, timezone, enabled status, or linked goal.",
    inputSchema: {
      type: "object",
      properties: {
        schedule_id: { type: "number", description: "Unique ID of the schedule to update" },
        title: { type: "string", description: "Updated title" },
        description: { type: "string", description: "Updated description" },
        start_at: { type: "string", description: "Updated start time (HH:mm)" },
        duration_minutes: { type: "number", description: "Updated duration in minutes" },
        recurrence: { type: "string", description: "Updated recurrence pattern" },
        timezone: { type: "string", description: "Updated timezone" },
        enabled: { type: "boolean", description: "Enable or pause schedule" },
        goal_id: { type: "number", description: "Updated linked goal ID" },
        task_id: { type: "number", description: "Updated linked task ID" },
        reminder_enabled: { type: "boolean", description: "Enable or disable reminder" },
      },
      required: ["schedule_id"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_schedule",
    description:
      "Deletes or stops future occurrences of a schedule without corrupting past completion history.",
    inputSchema: {
      type: "object",
      properties: {
        schedule_id: { type: "number", description: "Unique ID of the schedule to delete" },
      },
      required: ["schedule_id"],
      additionalProperties: false,
    },
  },
  {
    name: "complete_schedule",
    description:
      "Mark a specific date's occurrence of a schedule as completed. Example: User finished their 6 PM Java study session today.",
    inputSchema: {
      type: "object",
      properties: {
        schedule_id: { type: "number", description: "Unique ID of the schedule" },
        occurrence_date: { type: "string", description: "Occurrence date in YYYY-MM-DD format" },
      },
      required: ["schedule_id", "occurrence_date"],
      additionalProperties: false,
    },
  },
  {
    name: "skip_schedule",
    description:
      "Mark a specific date's occurrence of a schedule as skipped with an optional reason. Example: User took a rest day.",
    inputSchema: {
      type: "object",
      properties: {
        schedule_id: { type: "number", description: "Unique ID of the schedule" },
        occurrence_date: { type: "string", description: "Occurrence date in YYYY-MM-DD format" },
        reason: { type: "string", description: "Optional reason for skipping" },
      },
      required: ["schedule_id", "occurrence_date"],
      additionalProperties: false,
    },
  },
  {
    name: "get_upcoming_schedule",
    description:
      "Retrieve upcoming schedule occurrences for the user across the next N hours or days. Use when the user asks 'What is coming up next?' or 'What do I have scheduled for the next 3 days?'.",
    inputSchema: {
      type: "object",
      properties: {
        hours: { type: "number", description: "Lookahead in hours" },
        days: { type: "number", description: "Lookahead in days (default: 3)" },
      },
      additionalProperties: false,
    },
  },

  // --- TIMERS ---
  {
    name: "start_timer",
    description:
      "Start an active focus timer session immediately in LifeOS. Example: 'Start my Java study timer for 2 hours' or 'Start 25 minute focus session'. If another timer is running, it will automatically pause/stop it first.",
    inputSchema: {
      type: "object",
      properties: {
        duration_minutes: { type: "number", description: "Target duration in minutes (default: 25)" },
        title: { type: "string", description: "Title of the timer session (e.g. 'Java Study Session')" },
        schedule_id: { type: "number", description: "Optional schedule ID to link this timer to" },
        goal_id: { type: "number", description: "Optional goal ID to link this timer to" },
        task_id: { type: "number", description: "Optional task ID to link this timer to" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_active_timer",
    description:
      "Check if the user currently has an active (running or paused) timer session in LifeOS. Returns real-time elapsed seconds, remaining seconds, target duration, and linked goal/schedule. Returns clean 'no active timer' message if none is active.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "pause_timer",
    description:
      "Pause the user's currently running focus timer session in LifeOS and persist the elapsed time.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "resume_timer",
    description:
      "Resume the user's paused focus timer session in LifeOS.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "stop_timer",
    description:
      "Stop the user's active timer session in LifeOS. Calculates actual duration, marks it complete/stopped, logs an activity record, and automatically credits progress to any linked goal.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_timer_history",
    description:
      "Retrieve historical focus timer sessions for the authenticated user with total focus minutes, durations, dates, and linked goals.",
    inputSchema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "Filter start date (YYYY-MM-DD)" },
        end_date: { type: "string", description: "Filter end date (YYYY-MM-DD)" },
        goal_id: { type: "number", description: "Filter by linked goal ID" },
      },
      additionalProperties: false,
    },
  },

  // --- REMINDERS ---
  {
    name: "create_reminder",
    description:
      "Create a time-targeted notification/reminder for the user in LifeOS. Dispatches via Web Push when due.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Reminder title" },
        message: { type: "string", description: "Reminder message body" },
        remind_at: { type: "string", description: "ISO 8601 timestamp or local datetime when to alert the user" },
        schedule_id: { type: "number", description: "Optional linked schedule ID" },
        goal_id: { type: "number", description: "Optional linked goal ID" },
      },
      required: ["title", "message", "remind_at"],
      additionalProperties: false,
    },
  },
  {
    name: "get_reminders",
    description:
      "List upcoming and pending reminders for the authenticated user.",
    inputSchema: {
      type: "object",
      properties: {
        date_from: { type: "string", description: "Filter start date (YYYY-MM-DD)" },
        date_to: { type: "string", description: "Filter end date (YYYY-MM-DD)" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "update_reminder",
    description:
      "Update a reminder owned by the authenticated user in LifeOS.",
    inputSchema: {
      type: "object",
      properties: {
        reminder_id: { type: "number", description: "Unique ID of the reminder" },
        title: { type: "string", description: "Updated title" },
        message: { type: "string", description: "Updated message" },
        remind_at: { type: "string", description: "Updated alert timestamp" },
        status: { type: "string", enum: ["pending", "sent", "dismissed", "cancelled"], description: "Updated status" },
      },
      required: ["reminder_id"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_reminder",
    description:
      "Delete a reminder owned by the authenticated user in LifeOS.",
    inputSchema: {
      type: "object",
      properties: {
        reminder_id: { type: "number", description: "Unique ID of the reminder to delete" },
      },
      required: ["reminder_id"],
      additionalProperties: false,
    },
  },

  // --- TASKS ---
  {
    name: "get_tasks",
    description:
      "Retrieve tasks for the authenticated user. Optionally filter by status ('todo', 'in_progress', 'completed') or linked goal.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["todo", "in_progress", "completed", "cancelled"], description: "Filter by status" },
        goal_id: { type: "number", description: "Filter by linked goal ID" },
        limit: { type: "number", description: "Max tasks to return" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_task",
    description:
      "Create an actionable task in LifeOS optionally connected to a goal.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title" },
        description: { type: "string", description: "Optional description" },
        due_date: { type: "string", description: "Due date in YYYY-MM-DD format" },
        priority: { type: "number", description: "Priority level (1=high, 2=medium, 3=low)" },
        goal_id: { type: "number", description: "Optional linked goal ID" },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "update_task",
    description:
      "Update a task owned by the authenticated user in LifeOS.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "number", description: "Unique ID of the task to update" },
        title: { type: "string", description: "Updated task title" },
        description: { type: "string", description: "Updated description" },
        due_date: { type: "string", description: "Updated due date (YYYY-MM-DD)" },
        priority: { type: "number", description: "Updated priority" },
        status: { type: "string", enum: ["todo", "in_progress", "completed", "cancelled"], description: "Updated status" },
        goal_id: { type: "number", description: "Updated linked goal ID" },
      },
      required: ["task_id"],
      additionalProperties: false,
    },
  },
  {
    name: "complete_task",
    description:
      "Mark a task as completed with an optional completion note.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "number", description: "Unique ID of the task to complete" },
        note: { type: "string", description: "Optional completion note or summary of work done" },
      },
      required: ["task_id"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_task",
    description:
      "Delete a task owned by the authenticated user in LifeOS.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "number", description: "Unique ID of the task to delete" },
      },
      required: ["task_id"],
      additionalProperties: false,
    },
  },
  {
    name: "add_task_note",
    description:
      "Add a timestamped progress note, work log entry, or comment to a specific task in LifeOS.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "number", description: "Unique ID of the task to add a note to" },
        content: { type: "string", description: "Content of the note or work log" },
      },
      required: ["task_id", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "get_task_notes",
    description:
      "Retrieve the chronological history of notes and work logs for a task in LifeOS.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "number", description: "Unique ID of the task" },
      },
      required: ["task_id"],
      additionalProperties: false,
    },
  },

  // --- ACTIVITIES ---
  {
    name: "log_activity",
    description:
      "Log a historical activity or productivity event for the authenticated user. Examples: completed a coding sprint, workout, reading session, or job application.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["study", "coding", "workout", "reading", "application", "task", "general"],
          description: "Activity type",
        },
        title: { type: "string", description: "Activity title" },
        description: { type: "string", description: "Activity notes or summary" },
        duration: { type: "number", description: "Duration in minutes" },
        goal_id: { type: "number", description: "Optional linked goal ID" },
        task_id: { type: "number", description: "Optional linked task ID" },
      },
      required: ["type", "title"],
      additionalProperties: false,
    },
  },
  {
    name: "get_activities",
    description:
      "Retrieve historical activity logs and productivity events across a date range.",
    inputSchema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
        end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
        type: { type: "string", description: "Optional activity type filter" },
        limit: { type: "number", description: "Maximum number of activities to return" },
      },
      additionalProperties: false,
    },
  },

  // --- ROUTINES ---
  {
    name: "create_routine",
    description:
      "Create a structured daily routine grouping multiple scheduled habits. Example: Morning Routine (07:00 Wake up, 07:15 Exercise, 08:00 Breakfast, 08:30 Study).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Routine name (e.g. 'Morning Routine')" },
        description: { type: "string", description: "Optional routine description" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Step title" },
              startTime: { type: "string", description: "Start time (HH:mm)" },
              durationMinutes: { type: "number", description: "Duration in minutes" },
              scheduleId: { type: "number", description: "Optional schedule ID" },
            },
            required: ["title", "startTime"],
          },
          description: "List of routine steps in sequence",
        },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "get_routines",
    description:
      "List all configured routines and their sequential steps for the authenticated user.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "update_routine",
    description:
      "Update a routine owned by the authenticated user in LifeOS.",
    inputSchema: {
      type: "object",
      properties: {
        routine_id: { type: "number", description: "Unique ID of the routine" },
        name: { type: "string", description: "Updated routine name" },
        description: { type: "string", description: "Updated description" },
        active: { type: "boolean", description: "Active status" },
      },
      required: ["routine_id"],
      additionalProperties: false,
    },
  },
  {
    name: "pause_routine",
    description:
      "Pause a routine for the user.",
    inputSchema: {
      type: "object",
      properties: {
        routine_id: { type: "number", description: "Unique ID of the routine to pause" },
      },
      required: ["routine_id"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_routine",
    description:
      "Delete a routine owned by the user in LifeOS.",
    inputSchema: {
      type: "object",
      properties: {
        routine_id: { type: "number", description: "Unique ID of the routine to delete" },
      },
      required: ["routine_id"],
      additionalProperties: false,
    },
  },

  // --- CAREER ---
  {
    name: "get_job_applications",
    description:
      "List job applications tracked in LifeOS. Optionally filter by status ('bookmarked', 'applied', 'interviewing', 'offered', 'rejected', 'withdrawn').",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["bookmarked", "applied", "interviewing", "offered", "rejected", "withdrawn"],
          description: "Optional application status filter",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_job_application",
    description:
      "Log a new job application in LifeOS career management. Updates career progress and logs an activity record automatically.",
    inputSchema: {
      type: "object",
      properties: {
        company: { type: "string", description: "Company name" },
        role: { type: "string", description: "Role / job title" },
        status: {
          type: "string",
          enum: ["bookmarked", "applied", "interviewing", "offered", "rejected", "withdrawn"],
          description: "Initial application status (default: 'applied')",
        },
        applied_date: { type: "string", description: "Application date (YYYY-MM-DD, defaults to today)" },
        interview_date: { type: "string", description: "Upcoming interview date/time (ISO string)" },
        notes: { type: "string", description: "Application notes, recruiter contact, or interview stage" },
        salary: { type: "string", description: "Compensation / salary range" },
        url: { type: "string", description: "Job listing link" },
      },
      required: ["company", "role"],
      additionalProperties: false,
    },
  },
  {
    name: "update_job_application",
    description:
      "Update a job application status (e.g. advance to 'interviewing' or 'offered') and set interview dates or notes.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Unique ID of the job application" },
        company: { type: "string", description: "Updated company" },
        role: { type: "string", description: "Updated role" },
        status: {
          type: "string",
          enum: ["bookmarked", "applied", "interviewing", "offered", "rejected", "withdrawn"],
          description: "Updated status",
        },
        interview_date: { type: "string", description: "Upcoming interview timestamp (ISO string)" },
        notes: { type: "string", description: "Updated notes" },
        salary: { type: "string", description: "Updated salary" },
        url: { type: "string", description: "Updated listing URL" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_interviews",
    description:
      "Retrieve scheduled job interviews tracked in LifeOS.",
    inputSchema: {
      type: "object",
      properties: {
        upcoming_only: { type: "boolean", description: "If true, returns only upcoming interviews (default: true)" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_career_progress",
    description:
      "Get a career management summary in LifeOS: total applications, breakdown by status, interview conversion rate, offer rate, and linked career goal targets.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];
