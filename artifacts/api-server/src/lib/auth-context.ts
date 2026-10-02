import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import type { Request } from "express";
import { and, eq, gt, or, isNull } from "drizzle-orm";
import { db, mcpTokensTable, usersTable, profilesTable } from "@workspace/db";
import { getOrCreateUser } from "./lifeos";
import { logger } from "./logger";

export interface AuthenticatedUserContext {
  userId: number; // Integer ID in LifeOS users table
  clerkUserId: string; // Clerk user ID (e.g. user_2...)
  timezone: string;
  authMethod: "clerk_session" | "mcp_token" | "clerk_jwt";
}

const asyncLocalStorage = new AsyncLocalStorage<AuthenticatedUserContext>();

export function getAuthenticatedContext(): AuthenticatedUserContext {
  const ctx = asyncLocalStorage.getStore();
  if (!ctx) {
    const error: any = new Error("Authentication required: No active session context");
    error.status = 401;
    throw error;
  }
  return ctx;
}

export function runWithAuth<T>(context: AuthenticatedUserContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function resolveUserFromAuthHeader(req: Request): Promise<AuthenticatedUserContext | null> {
  // 1. Check if Clerk Express middleware already resolved req.userId (from session or Clerk bearer token)
  if (req.userId) {
    const user = await getOrCreateUser(req.userId);
    return {
      userId: user.id,
      clerkUserId: req.userId,
      timezone: user.timezone || "Asia/Calcutta",
      authMethod: "clerk_session",
    };
  }

  // 2. Check Authorization Header: Bearer <token>
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const rawToken = authHeader.slice(7).trim();
  if (!rawToken) return null;

  // 2a. Check if it's a LifeOS MCP token (starts with los_mcp_)
  if (rawToken.startsWith("los_mcp_")) {
    const hashed = hashToken(rawToken);
    const now = new Date();

    const [tokenRecord] = await db
      .select({
        id: mcpTokensTable.id,
        userId: mcpTokensTable.userId,
        clerkUserId: usersTable.clerkUserId,
        timezone: profilesTable.timezone,
        expiresAt: mcpTokensTable.expiresAt,
      })
      .from(mcpTokensTable)
      .innerJoin(usersTable, eq(usersTable.id, mcpTokensTable.userId))
      .leftJoin(profilesTable, eq(profilesTable.userId, usersTable.id))
      .where(
        and(
          eq(mcpTokensTable.tokenHash, hashed),
          or(isNull(mcpTokensTable.expiresAt), gt(mcpTokensTable.expiresAt, now)),
        ),
      )
      .limit(1);

    if (tokenRecord) {
      // Asynchronously update lastUsedAt
      void db
        .update(mcpTokensTable)
        .set({ lastUsedAt: new Date() })
        .where(eq(mcpTokensTable.id, tokenRecord.id))
        .catch((err) => logger.warn({ err }, "Failed to update MCP token lastUsedAt"));

      return {
        userId: tokenRecord.userId,
        clerkUserId: tokenRecord.clerkUserId,
        timezone: tokenRecord.timezone || "Asia/Calcutta",
        authMethod: "mcp_token",
      };
    }

    return null;
  }

  // 2b. Attempt to verify as Clerk JWT token if it has 3 parts (ey...)
  if (rawToken.split(".").length === 3) {
    try {
      // Decode JWT payload to get sub (clerk user ID)
      const base64Url = rawToken.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join(""),
      );
      const parsed = JSON.parse(jsonPayload);
      const clerkUserId = parsed.sub;

      if (clerkUserId && typeof clerkUserId === "string") {
        const user = await getOrCreateUser(clerkUserId);
        return {
          userId: user.id,
          clerkUserId,
          timezone: user.timezone || "Asia/Calcutta",
          authMethod: "clerk_jwt",
        };
      }
    } catch (err) {
      logger.debug({ err }, "Could not decode JWT bearer token");
    }
  }

  return null;
}
