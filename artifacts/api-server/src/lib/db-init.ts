import { pool } from "@workspace/db";
import { logger } from "./logger";

export async function ensureAllTables() {
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        -- Push Subscriptions & Reminder Configs
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          endpoint TEXT NOT NULL,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          user_agent TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_idx ON push_subscriptions(endpoint);
        CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_idx ON push_subscriptions(user_id, endpoint);

        CREATE TABLE IF NOT EXISTS user_reminders_config (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          morning_kickoff_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          morning_kickoff_time TEXT NOT NULL DEFAULT '08:30',
          evening_reflection_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          evening_reflection_time TEXT NOT NULL DEFAULT '21:00',
          goal_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          goal_schedules JSONB DEFAULT '{}',
          timezone TEXT NOT NULL DEFAULT 'Asia/Calcutta',
          last_morning_notified_date TEXT,
          last_evening_notified_date TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS user_reminders_config_user_idx ON user_reminders_config(user_id);

        -- Tasks
        CREATE TABLE IF NOT EXISTS tasks (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          description TEXT,
          due_date DATE,
          priority INTEGER NOT NULL DEFAULT 2,
          status TEXT NOT NULL DEFAULT 'todo',
          completed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS tasks_user_idx ON tasks(user_id);
        CREATE INDEX IF NOT EXISTS tasks_user_status_idx ON tasks(user_id, status);

        -- Task Notes (Chronological execution log)
        CREATE TABLE IF NOT EXISTS task_notes (
          id SERIAL PRIMARY KEY,
          task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS task_notes_task_idx ON task_notes(task_id);
        CREATE INDEX IF NOT EXISTS task_notes_user_idx ON task_notes(user_id);

        -- Schedules
        CREATE TABLE IF NOT EXISTS schedules (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT,
          start_at TEXT NOT NULL,
          duration_minutes INTEGER NOT NULL DEFAULT 60,
          timezone TEXT NOT NULL DEFAULT 'Asia/Calcutta',
          recurrence TEXT NOT NULL DEFAULT 'none',
          start_date DATE NOT NULL,
          end_date DATE,
          enabled BOOLEAN NOT NULL DEFAULT TRUE,
          status TEXT NOT NULL DEFAULT 'active',
          goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
          task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
          reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
          reminder_minutes_before INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS schedules_user_idx ON schedules(user_id);
        CREATE INDEX IF NOT EXISTS schedules_start_date_idx ON schedules(start_date);

        -- Schedule Occurrences
        CREATE TABLE IF NOT EXISTS schedule_occurrences (
          id SERIAL PRIMARY KEY,
          schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          occurrence_date DATE NOT NULL,
          status TEXT NOT NULL DEFAULT 'completed',
          reason TEXT,
          completed_at TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS schedule_occurrences_unique_idx ON schedule_occurrences(schedule_id, occurrence_date);
        CREATE INDEX IF NOT EXISTS schedule_occurrences_user_date_idx ON schedule_occurrences(user_id, occurrence_date);

        -- Timers
        CREATE TABLE IF NOT EXISTS timers (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          schedule_id INTEGER REFERENCES schedules(id) ON DELETE SET NULL,
          goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
          task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          paused_at TIMESTAMPTZ,
          accumulated_seconds INTEGER NOT NULL DEFAULT 0,
          target_duration_seconds INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'running',
          completed_at TIMESTAMPTZ,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS timers_user_idx ON timers(user_id);
        CREATE INDEX IF NOT EXISTS timers_user_status_idx ON timers(user_id, status);

        -- Activities
        CREATE TABLE IF NOT EXISTS activities (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL DEFAULT 'general',
          title TEXT NOT NULL,
          description TEXT,
          duration_minutes INTEGER DEFAULT 0,
          goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
          task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
          timer_id INTEGER REFERENCES timers(id) ON DELETE SET NULL,
          activity_date DATE NOT NULL,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS activities_user_idx ON activities(user_id);
        CREATE INDEX IF NOT EXISTS activities_user_date_idx ON activities(user_id, activity_date);

        -- Reminders
        CREATE TABLE IF NOT EXISTS reminders (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          remind_at TIMESTAMPTZ NOT NULL,
          schedule_id INTEGER REFERENCES schedules(id) ON DELETE SET NULL,
          goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          sent_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS reminders_user_idx ON reminders(user_id);
        CREATE INDEX IF NOT EXISTS reminders_remind_at_idx ON reminders(remind_at);

        -- Routines
        CREATE TABLE IF NOT EXISTS routines (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT,
          active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS routines_user_idx ON routines(user_id);

        CREATE TABLE IF NOT EXISTS routine_items (
          id SERIAL PRIMARY KEY,
          routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
          schedule_id INTEGER REFERENCES schedules(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          start_time TEXT NOT NULL,
          duration_minutes INTEGER NOT NULL DEFAULT 30,
          order_index INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS routine_items_routine_idx ON routine_items(routine_id);

        -- Career / Job Applications
        CREATE TABLE IF NOT EXISTS job_applications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          company TEXT NOT NULL,
          role TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'applied',
          applied_date DATE,
          interview_date TIMESTAMPTZ,
          notes TEXT,
          salary TEXT,
          url TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS job_applications_user_idx ON job_applications(user_id);
        CREATE INDEX IF NOT EXISTS job_applications_status_idx ON job_applications(status);

        -- MCP Authentication Tokens & OAuth Codes
        CREATE TABLE IF NOT EXISTS mcp_tokens (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          token_hash TEXT NOT NULL UNIQUE,
          token_prefix TEXT NOT NULL,
          scopes TEXT NOT NULL DEFAULT 'all',
          expires_at TIMESTAMPTZ,
          last_used_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS mcp_tokens_user_idx ON mcp_tokens(user_id);

        CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
          id SERIAL PRIMARY KEY,
          code TEXT NOT NULL UNIQUE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          client_id TEXT NOT NULL,
          redirect_uri TEXT NOT NULL,
          code_challenge TEXT NOT NULL,
          code_challenge_method TEXT NOT NULL DEFAULT 'S256',
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS mcp_oauth_codes_expires_idx ON mcp_oauth_codes(expires_at);
      `);
      logger.info("Database tables and indexes verified.");
    } finally {
      client.release();
    }
  } catch (err) {
    logger.warn({ err }, "Could not auto-verify database tables on startup");
  }
}

// Preserve backward-compatible export
export const ensureNotificationTables = ensureAllTables;
