import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, serial, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const mcpTokensTable = pgTable(
  "mcp_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g. "ChatGPT MCP Token"
    tokenHash: text("token_hash").notNull(), // SHA-256 hash of raw token
    tokenPrefix: text("token_prefix").notNull(), // e.g. "los_mcp_a1b2..."
    scopes: text("scopes").notNull().default("all"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("mcp_tokens_token_hash_idx").on(table.tokenHash),
    userTokensIdx: index("mcp_tokens_user_idx").on(table.userId),
  })
);

export const mcpOauthCodesTable = pgTable(
  "mcp_oauth_codes",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    redirectUri: text("redirect_uri").notNull(),
    codeChallenge: text("code_challenge").notNull(),
    codeChallengeMethod: text("code_challenge_method").notNull().default("S256"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    codeIdx: uniqueIndex("mcp_oauth_codes_code_idx").on(table.code),
    expiresIdx: index("mcp_oauth_codes_expires_idx").on(table.expiresAt),
  })
);

export const insertMcpTokenSchema = createInsertSchema(mcpTokensTable).omit({ id: true, createdAt: true });
export type McpToken = typeof mcpTokensTable.$inferSelect;
export type InsertMcpToken = typeof mcpTokensTable.$inferInsert;
export type McpOauthCode = typeof mcpOauthCodesTable.$inferSelect;
export type InsertMcpOauthCode = typeof mcpOauthCodesTable.$inferInsert;
