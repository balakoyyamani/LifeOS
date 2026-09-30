import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  console.log("[DB Migration] Starting migration execution...");
  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, "../drizzle"),
  });
  console.log("[DB Migration] All pending migrations executed successfully.");
  await pool.end();
}

runMigrations().catch((err) => {
  console.error("[DB Migration] Migration failed:", err);
  process.exit(1);
});
