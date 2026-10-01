import { pool } from "@workspace/db";
import { logger } from "./logger";

export async function ensureNotificationTables() {
  try {
    const client = await pool.connect();
    try {
      await client.query(`
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
      `);
      logger.info("Notification tables and indexes verified.");
    } finally {
      client.release();
    }
  } catch (err) {
    logger.warn({ err }, "Could not auto-verify notification tables on startup");
  }
}
