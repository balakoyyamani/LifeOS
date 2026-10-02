import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { ensureAllTables } from "./lib/db-init";
import { startScheduleDispatcher, stopScheduleDispatcher } from "./lib/schedule-dispatcher";

const rawPort = process.env["PORT"] || "5000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, async () => {
  logger.info({ port }, "Server listening");
  await ensureAllTables();
  startScheduleDispatcher();
});

function gracefulShutdown(signal: string) {
  logger.info({ signal }, "Received shutdown signal, closing server gracefully");
  stopScheduleDispatcher();
  server.close(async () => {
    logger.info("HTTP server closed");
    try {
      await pool.end();

      logger.info("Database pool closed successfully");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error closing database pool");
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error("Forced shutdown due to timeout");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (error) => {
  logger.fatal({ error }, "Uncaught exception");
  process.exit(1);
});
