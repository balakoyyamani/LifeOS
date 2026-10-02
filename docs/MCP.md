# LifeOS Model Context Protocol (MCP) Server

Production-quality Model Context Protocol (MCP) server enabling ChatGPT, Claude, Cursor, and other AI clients to securely interact with authenticated LifeOS accounts.

**Production Endpoint:** `https://lifesos.online/mcp`  
**Protocol Version:** `2024-11-05`  
**Transport:** Streamable HTTP / JSON-RPC 2.0 / Server-Sent Events (SSE)

---

## 1. Architecture & Security Model

The LifeOS MCP server connects directly to the core LifeOS service and database layers without creating duplicate implementations or compromising security.

```
ChatGPT / MCP Client (Authorization: Bearer <token>)
        ↓
HTTPS POST/GET /mcp
        ↓
LifeOS MCP Router & Rate Limiter (60 req/min)
        ↓
Authentication & Context Resolution:
  - LifeOS Personal Access Token (SHA-256 hashed)
  - Clerk Session JWT verification
  - OAuth 2.1 PKCE Authorization
        ↓
Node.js AsyncLocalStorage Context (User ID, Timezone)
        ↓
LifeOS Service Layer (Goals, Schedules, Timers, Reminders, Tasks, Activities, Career)
        ↓
Drizzle ORM Parameterized PostgreSQL Database Queries (Strict User ID Ownership)
```

### Security Guarantees
- **No arbitrary SQL execution:** The MCP server interacts exclusively through strongly-typed, schema-validated service functions.
- **No credentials exposed:** `DATABASE_URL`, Clerk secret keys, Supabase keys, and VAPID private keys are never exposed in tool schemas, inputs, outputs, or error responses.
- **Strict User Isolation:** Every query and mutation is automatically scoped to `context.userId`. Users can never access or modify records belonging to other users.
- **Safe Error Reporting:** Errors return structured, sanitised messages (`{ isError: true, content: [...] }`) with internal stack traces and secrets suppressed.
- **Rate Limiting:** Built-in rate limiting prevents brute force, abuse, or accidental agent loops.

---

## 2. Authentication Methods

The MCP server supports three production authentication workflows:

### A. Personal Access Tokens (Recommended for ChatGPT Custom GPTs / Claude / Cursor)
1. In the LifeOS Web App, navigate to **Settings** (`/settings`).
2. Scroll to the **Model Context Protocol (MCP)** section.
3. Click **Generate Token** (e.g. `ChatGPT Assistant`).
4. Copy the generated secret token (format: `los_mcp_<64-hex-characters>`).
5. In your MCP client or ChatGPT Action, set the header:
   ```http
   Authorization: Bearer los_mcp_your_token_here
   ```

### B. Clerk JWT Session Tokens
If your client holds a valid Clerk user JWT session token, provide it directly in the `Authorization` header:
```http
Authorization: Bearer <clerk_session_jwt>
```
The server resolves the Clerk user ID (`sub`) and maps it to the corresponding LifeOS account.

### C. OAuth 2.1 with PKCE (RFC 7636 / RFC 8414)
For clients supporting standard OAuth 2.1:
- **Discovery Endpoint:** `GET https://lifesos.online/.well-known/oauth-authorization-server`
- **OpenID Config:** `GET https://lifesos.online/.well-known/openid-configuration`
- **Authorize Endpoint:** `GET https://lifesos.online/oauth/authorize?client_id=...&redirect_uri=...&code_challenge=...&code_challenge_method=S256`
- **Token Endpoint:** `POST https://lifesos.online/oauth/token`

---

## 3. Available MCP Tools (42 Tools)

### Dashboard (2 Tools)
| Tool | Description | Parameters |
|---|---|---|
| `get_today` | Returns today's active goals, daily completion progress, schedule occurrences, active timer, reminders, and daily score summary. | *(None)* |
| `get_dashboard` | Returns overall goals, today's completion, weekly progress, upcoming 3-day schedules, recent activity, and category balance. | *(None)* |

### Goals (6 Tools)
| Tool | Description | Parameters |
|---|---|---|
| `get_goals` | List recurring goals for the authenticated user. | `status?: 'active'\|'inactive'\|'all'`, `search?: string`, `limit?: number` |
| `create_goal` | Create a new goal. | `title: string` (required), `target?: number`, `unit?: string`, `frequency?: 'daily'\|'weekdays'\|'weekly'`, `deadline?: string`, `priority?: number`, `category?: string` |
| `update_goal` | Update an existing goal. | `goal_id: number` (required), `title?: string`, `target?: number`, `unit?: string`, `deadline?: string`, `priority?: number`, `status?: 'active'\|'inactive'`, `category?: string` |
| `delete_goal` | Soft delete / deactivate an existing goal while preserving historical progress. | `goal_id: number` (required) |
| `update_daily_progress` | Log measurable progress for today or a specific date. | `goal_id: number` (required), `progress: number` (required), `date?: string`, `note?: string` |
| `get_progress` | Get historical goal completion analytics and daily logs. | `goal_id?: number`, `start_date?: string`, `end_date?: string` |

### Schedules & Recurrence (7 Tools)
| Tool | Description | Parameters |
|---|---|---|
| `create_schedule` | Create a one-time or recurring schedule. Supports recurrence: `'none'`, `'daily'`, `'weekdays'`, `'weekends'`, `'weekly'`, `'weekly:MON,WED,FRI'`, `'every_n_days:N'`, `'monthly'`. | `title: string` (required), `start_at: string` (required, e.g. `'18:00'`), `duration_minutes?: number`, `recurrence?: string`, `start_date?: string`, `end_date?: string`, `goal_id?: number`, `task_id?: number`, `reminder_enabled?: boolean` |
| `get_schedule` | List schedules and dynamic occurrences within a date range (default: today). | `date_from?: string`, `date_to?: string`, `status?: string`, `include_completed?: boolean`, `include_recurring?: boolean` |
| `update_schedule` | Update a schedule's title, time, duration, recurrence, or linked goal. | `schedule_id: number` (required), `title?: string`, `start_at?: string`, `duration_minutes?: number`, `recurrence?: string`, `enabled?: boolean` |
| `delete_schedule` | Deactivates future occurrences without corrupting historical completion data. | `schedule_id: number` (required) |
| `complete_schedule` | Mark a specific date's occurrence as completed. | `schedule_id: number` (required), `occurrence_date: string` (required, YYYY-MM-DD) |
| `skip_schedule` | Mark a specific date's occurrence as skipped with optional reason. | `schedule_id: number` (required), `occurrence_date: string` (required), `reason?: string` |
| `get_upcoming_schedule` | Get upcoming occurrences across the next N hours or days. | `hours?: number`, `days?: number` (default: 3) |

### Focus Timers (6 Tools)
| Tool | Description | Parameters |
|---|---|---|
| `start_timer` | Immediately starts a focus timer session. Automatically stops/pauses previous active timers. | `duration_minutes?: number` (default: 25), `title?: string`, `schedule_id?: number`, `goal_id?: number`, `task_id?: number` |
| `get_active_timer` | Returns real-time elapsed seconds, remaining seconds, target duration, and linked goal/schedule. | *(None)* |
| `pause_timer` | Pauses running timer and persists elapsed time. | *(None)* |
| `resume_timer` | Resumes a paused timer session. | *(None)* |
| `stop_timer` | Stops active timer, records actual duration, logs activity, and updates linked goal progress. | *(None)* |
| `get_timer_history` | Returns historical timer sessions and total focus minutes. | `start_date?: string`, `end_date?: string`, `goal_id?: number` |

### Reminders (4 Tools)
| Tool | Description | Parameters |
|---|---|---|
| `create_reminder` | Schedule a push notification for a specific date and time. | `title: string` (required), `message: string` (required), `remind_at: string` (required), `schedule_id?: number`, `goal_id?: number` |
| `get_reminders` | List pending and upcoming reminders. | `date_from?: string`, `date_to?: string` |
| `update_reminder` | Update title, message, alert time, or status. | `reminder_id: number` (required), `title?: string`, `message?: string`, `remind_at?: string`, `status?: string` |
| `delete_reminder` | Delete a scheduled reminder. | `reminder_id: number` (required) |

### Tasks (5 Tools)
| Tool | Description | Parameters |
|---|---|---|
| `get_tasks` | List tasks optionally filtered by status or goal. | `status?: string`, `goal_id?: number`, `limit?: number` |
| `create_task` | Create an actionable task linked to a goal. | `title: string` (required), `description?: string`, `due_date?: string`, `priority?: number`, `goal_id?: number` |
| `update_task` | Update task title, due date, priority, or status. | `task_id: number` (required), `title?: string`, `due_date?: string`, `priority?: number`, `status?: string` |
| `complete_task` | Mark task as completed. | `task_id: number` (required) |
| `delete_task` | Delete a task. | `task_id: number` (required) |

### Activity Logging (2 Tools)
| Tool | Description | Parameters |
|---|---|---|
| `log_activity` | Log a completed study, workout, coding sprint, reading, or application activity. | `type: string` (required), `title: string` (required), `duration?: number`, `goal_id?: number` |
| `get_activities` | Retrieve logged activities and total duration across date ranges. | `start_date?: string`, `end_date?: string`, `type?: string`, `limit?: number` |

### Routines (5 Tools)
| Tool | Description | Parameters |
|---|---|---|
| `create_routine` | Group sequential schedules into a morning or evening routine. | `name: string` (required), `description?: string`, `items?: Array<{ title, startTime, durationMinutes }>` |
| `get_routines` | List all configured routines and their steps. | *(None)* |
| `update_routine` | Update routine name, description, or active status. | `routine_id: number` (required), `name?: string`, `active?: boolean` |
| `pause_routine` | Pause an active routine. | `routine_id: number` (required) |
| `delete_routine` | Delete a routine. | `routine_id: number` (required) |

### Career & Job Applications (5 Tools)
| Tool | Description | Parameters |
|---|---|---|
| `get_job_applications` | List tracked job applications with status filters. | `status?: 'bookmarked'\|'applied'\|'interviewing'\|'offered'\|'rejected'\|'withdrawn'` |
| `create_job_application` | Log a job application and update career progress. | `company: string` (required), `role: string` (required), `status?: string`, `applied_date?: string`, `salary?: string`, `url?: string` |
| `update_job_application` | Update application status, interview date, or recruiter notes. | `id: number` (required), `status?: string`, `interview_date?: string`, `notes?: string` |
| `get_interviews` | Retrieve scheduled job interviews. | `upcoming_only?: boolean` |
| `get_career_progress` | Get career metrics: total applications, interview rate, offer rate, and career goal targets. | *(None)* |

---

## 4. Example ChatGPT Prompts & Natural Language Usage

| User Prompt | Expected Tool Invocation |
|---|---|
| *"What do I have to do today?"* | `get_today()` |
| *"Show my overall dashboard."* | `get_dashboard()` |
| *"What are my active goals?"* | `get_goals(status="active")` |
| *"Create a goal to finish Spring Boot."* | `create_goal(title="Finish Spring Boot", category="learning", target=120, unit="minutes")` |
| *"I practiced coding for 45 minutes today."* | `update_daily_progress(goal_id=2, progress=45)` |
| *"Schedule Java study every weekday at 6 PM for 2 hours."* | `create_schedule(title="Java Study", start_at="18:00", duration_minutes=120, recurrence="weekdays")` |
| *"What do I have scheduled for tomorrow?"* | `get_schedule(date_from="2026-10-03", date_to="2026-10-03")` |
| *"Mark today's 6 PM study session complete."* | `complete_schedule(schedule_id=1, occurrence_date="2026-10-02")` |
| *"Start my Java study timer for 2 hours."* | `start_timer(title="Java Study", duration_minutes=120)` |
| *"Pause my timer."* | `pause_timer()` |
| *"Resume my timer."* | `resume_timer()` |
| *"Stop my timer."* | `stop_timer()` |
| *"How many job applications have I sent?"* | `get_career_progress()` |
| *"I applied to Google for Senior Backend Engineer."* | `create_job_application(company="Google", role="Senior Backend Engineer")` |

---

## 5. Local Verification & Testing

Run all unit, schedule recurrence, and MCP tool security tests:
```bash
pnpm test
```

Run workspace TypeScript compilation:
```bash
pnpm run typecheck
```

Build production Docker/Node bundles:
```bash
pnpm run build
```
