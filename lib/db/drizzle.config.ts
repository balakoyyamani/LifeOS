import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  try { (process as any).loadEnvFile?.(); } catch {}
  try { (process as any).loadEnvFile?.(path.resolve(__dirname, "../../artifacts/api-server/.env")); } catch {}
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
