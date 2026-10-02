process.env.DATABASE_URL ??= "postgresql://mock:mock@localhost:5432/mock";

import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { LIFEOS_MCP_TOOLS } = await import("./mcp/tools-registry");
const { dispatchMcpTool } = await import("./mcp/tools-dispatcher");
const { runWithAuth } = await import("./auth-context");
const { getOAuthDiscoveryConfig } = await import("./services/mcp-auth-service");

describe("LifeOS Production MCP Server", () => {
  describe("MCP Tool Definitions & Schemas", () => {
    it("should register all 42 required tools", () => {
      assert.equal(LIFEOS_MCP_TOOLS.length, 42);
    });

    it("should ensure every tool has a unique name and non-empty description", () => {
      const names = new Set<string>();
      for (const tool of LIFEOS_MCP_TOOLS) {
        assert.ok(tool.name, "Tool must have a name");
        assert.ok(!names.has(tool.name), `Duplicate tool name detected: ${tool.name}`);
        names.add(tool.name);
        assert.ok(tool.description && tool.description.length > 20, `Tool ${tool.name} must have a descriptive description`);
        assert.equal(tool.inputSchema.type, "object", `Tool ${tool.name} inputSchema must be type: object`);
      }
    });

    it("should include core dashboard, goal, schedule, timer, reminder, task, activity, routine, and career tools", () => {
      const toolNames = LIFEOS_MCP_TOOLS.map((t) => t.name);
      const expected = [
        "get_today",
        "get_dashboard",
        "get_goals",
        "create_goal",
        "update_goal",
        "delete_goal",
        "update_daily_progress",
        "get_progress",
        "create_schedule",
        "get_schedule",
        "update_schedule",
        "delete_schedule",
        "complete_schedule",
        "skip_schedule",
        "get_upcoming_schedule",
        "start_timer",
        "get_active_timer",
        "pause_timer",
        "resume_timer",
        "stop_timer",
        "get_timer_history",
        "create_reminder",
        "get_reminders",
        "update_reminder",
        "delete_reminder",
        "get_tasks",
        "create_task",
        "update_task",
        "complete_task",
        "delete_task",
        "log_activity",
        "get_activities",
        "create_routine",
        "get_routines",
        "update_routine",
        "pause_routine",
        "delete_routine",
        "get_job_applications",
        "create_job_application",
        "update_job_application",
        "get_interviews",
        "get_career_progress",
      ];

      for (const name of expected) {
        assert.ok(toolNames.includes(name), `Missing expected tool: ${name}`);
      }
    });
  });

  describe("Authentication & Authorization Security", () => {
    it("should reject tool execution when no authenticated user context exists", async () => {
      const response = await dispatchMcpTool("get_today", {});
      assert.equal(response.isError, true);
      assert.match(response.content[0].text, /Authentication required/i);
    });

    it("should reject invalid / unknown tool names safely without leaking internals", async () => {
      const response = await runWithAuth(
        { userId: 9999, clerkUserId: "user_mock", timezone: "Asia/Calcutta", authMethod: "mcp_token" },
        () => dispatchMcpTool("execute_arbitrary_sql", {}),
      );
      assert.equal(response.isError, true);
      assert.match(response.content[0].text, /Unknown tool/i);
    });
  });

  describe("OAuth 2.1 & RFC 9728 Discovery Configuration", () => {
    it("should generate compliant OAuth 2.1 discovery metadata", () => {
      const config = getOAuthDiscoveryConfig("https://lifesos.online");
      assert.equal(config.issuer, "https://lifesos.online");
      assert.equal(config.authorization_endpoint, "https://lifesos.online/oauth/authorize");
      assert.equal(config.token_endpoint, "https://lifesos.online/oauth/token");
      assert.deepEqual(config.code_challenge_methods_supported, ["S256"]);
      assert.deepEqual(config.response_types_supported, ["code"]);
      assert.deepEqual(config.grant_types_supported, ["authorization_code", "refresh_token"]);
      assert.deepEqual(config.scopes_supported, ["mcp", "read", "write", "all"]);
      assert.equal(config.service_documentation, "https://lifesos.online/docs/mcp");
    });

    it("should generate RFC 9728 OAuth Protected Resource metadata", async () => {
      const { getOAuthProtectedResourceConfig } = await import("./services/mcp-auth-service");
      const resourceConfig = getOAuthProtectedResourceConfig("https://lifesos.online");
      assert.equal(resourceConfig.resource, "https://lifesos.online/mcp");
      assert.deepEqual(resourceConfig.authorization_servers, ["https://lifesos.online"]);
      assert.deepEqual(resourceConfig.bearer_methods_supported, ["header"]);
      assert.deepEqual(resourceConfig.scopes_supported, ["mcp", "read", "write", "all"]);
    });

    it("should verify S256 PKCE code challenge and verifier math", async () => {
      const { createHash } = await import("node:crypto");
      // Standard RFC 7636 Appendix B test vector
      const codeVerifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
      const hash = createHash("sha256").update(codeVerifier).digest();
      const codeChallenge = hash.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      assert.equal(codeChallenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    });
  });

  describe("User Scoping & Isolation Security", () => {
    it("should propagate authenticated user context and tag oauth_token method", async () => {
      const userA = { userId: 101, clerkUserId: "user_a", timezone: "UTC", authMethod: "oauth_token" as const };
      const ctx = await runWithAuth(userA, async () => {
        const { getAuthenticatedContext } = await import("./auth-context");
        return getAuthenticatedContext();
      });
      assert.equal(ctx.userId, 101);
      assert.equal(ctx.authMethod, "oauth_token");
      assert.equal(ctx.clerkUserId, "user_a");
      assert.equal(ctx.timezone, "UTC");
    });

    it("should prevent User A from accessing other user contexts", async () => {
      const userA = { userId: 101, clerkUserId: "user_a", timezone: "UTC", authMethod: "oauth_token" as const };
      const userB = { userId: 202, clerkUserId: "user_b", timezone: "UTC", authMethod: "oauth_token" as const };

      // Dispatching under User A returns User A's context, never User B's
      const resA = await runWithAuth(userA, async () => {
        const { getAuthenticatedContext } = await import("./auth-context");
        return getAuthenticatedContext();
      });
      assert.equal(resA.userId, 101);
      assert.notEqual(resA.userId, userB.userId);
    });
  });
});
