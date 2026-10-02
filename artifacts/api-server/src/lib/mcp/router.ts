import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { resolveUserFromAuthHeader, runWithAuth } from "../auth-context";
import { LIFEOS_MCP_TOOLS } from "./tools-registry";
import { dispatchMcpTool } from "./tools-dispatcher";
import {
  createAuthorizationCode,
  exchangeAuthorizationCode,
  generateMcpToken,
  getOAuthDiscoveryConfig,
  getOAuthProtectedResourceConfig,
  listMcpTokens,
  revokeMcpToken,
} from "../services/mcp-auth-service";
import { logger } from "../logger";

const router = Router();

// MCP specific rate limiting (60 requests per minute per IP)
const mcpRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests to MCP endpoint, please retry in a moment." },
});

// Helper to determine base URL
function getBaseUrl(req: Request): string {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "lifesos.online";
  const proto = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
  return `${proto}://${host}`;
}

// -----------------------------------------------------------------------------
// OAUTH 2.1 & RFC 9728 DISCOVERY ENDPOINTS
// -----------------------------------------------------------------------------
const handleDiscovery = (req: Request, res: Response) => {
  res.json(getOAuthDiscoveryConfig(getBaseUrl(req)));
};

router.get("/.well-known/oauth-authorization-server", handleDiscovery);
router.get("/.well-known/openid-configuration", handleDiscovery);

const handleProtectedResource = (req: Request, res: Response) => {
  res.json(getOAuthProtectedResourceConfig(getBaseUrl(req)));
};

router.get("/.well-known/oauth-protected-resource", handleProtectedResource);
router.get("/.well-known/oauth-protected-resource/mcp", handleProtectedResource);

// -----------------------------------------------------------------------------
// OAUTH 2.1 AUTHORIZATION & TOKEN ENDPOINTS
// -----------------------------------------------------------------------------
router.get("/oauth/authorize", async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      client_id,
      redirect_uri,
      response_type,
      state,
      code_challenge,
      code_challenge_method,
    } = req.query as Record<string, string>;

    if (!client_id || !redirect_uri) {
      res.status(400).send("Missing client_id or redirect_uri.");
      return;
    }

    if (response_type && response_type !== "code") {
      res.status(400).send("Unsupported response_type. LifeOS only supports 'code'.");
      return;
    }

    const userCtx = await resolveUserFromAuthHeader(req);
    if (!userCtx) {
      // User not signed in -> redirect to Clerk sign-in with return URL
      const returnUrl = encodeURIComponent(req.originalUrl);
      res.redirect(`/sign-in?redirect_url=${returnUrl}`);
      return;
    }

    // Generate authorization code with PKCE
    const code = await createAuthorizationCode({
      userId: userCtx.userId,
      clientId: client_id,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge || "",
      codeChallengeMethod: code_challenge_method || "S256",
    });

    const redirectTarget = new URL(redirect_uri);
    redirectTarget.searchParams.set("code", code);
    if (state) redirectTarget.searchParams.set("state", state);

    res.redirect(redirectTarget.toString());
  } catch (err: any) {
    logger.error({ err }, "Error in /oauth/authorize");
    res.status(500).send("Authorization failed: " + (err?.message || "Unknown error"));
  }
});

router.post("/oauth/token", async (req: Request, res: Response): Promise<void> => {
  try {
    let { grant_type, code, redirect_uri, client_id, code_verifier } = req.body || {};

    // Also support client_id via HTTP Basic Authorization header if omitted from body
    const authHeader = req.headers.authorization;
    if (!client_id && authHeader && authHeader.startsWith("Basic ")) {
      try {
        const creds = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
        const [id] = creds.split(":");
        if (id) client_id = id;
      } catch {}
    }

    if (grant_type !== "authorization_code") {
      res.status(400).json({ error: "unsupported_grant_type", error_description: "Only authorization_code supported." });
      return;
    }

    if (!code || !code_verifier) {
      res.status(400).json({ error: "invalid_request", error_description: "Missing required code or code_verifier." });
      return;
    }

    const tokenResponse = await exchangeAuthorizationCode({
      code,
      clientId: client_id,
      redirectUri: redirect_uri,
      codeVerifier: code_verifier,
    });

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json(tokenResponse);
  } catch (err: any) {
    logger.warn({ err: err?.message }, "Failed token exchange");
    res.status(400).json({ error: "invalid_grant", error_description: err?.message || "Token exchange failed." });
  }
});

// -----------------------------------------------------------------------------
// MCP TOKENS MANAGEMENT API (for frontend /settings)
// -----------------------------------------------------------------------------
router.get("/api/mcp/tokens", async (req: Request, res: Response): Promise<void> => {
  const userCtx = await resolveUserFromAuthHeader(req);
  if (!userCtx) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const tokens = await listMcpTokens(userCtx.userId);
  res.json({ tokens });
});

router.post("/api/mcp/tokens", async (req: Request, res: Response): Promise<void> => {
  const userCtx = await resolveUserFromAuthHeader(req);
  if (!userCtx) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const name = req.body?.name || "ChatGPT MCP Token";
  const created = await generateMcpToken(userCtx.userId, name);
  res.status(201).json(created);
});

router.delete("/api/mcp/tokens/:id", async (req: Request, res: Response): Promise<void> => {
  const userCtx = await resolveUserFromAuthHeader(req);
  if (!userCtx) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const tokenId = Number(req.params.id);
  const result = await revokeMcpToken(userCtx.userId, tokenId);
  res.json(result);
});

// -----------------------------------------------------------------------------
// CORE MCP STREAMABLE HTTP & JSON-RPC PROTOCOL HANDLER
// -----------------------------------------------------------------------------
async function handleMcpRequest(req: Request, res: Response): Promise<void> {
  const baseUrl = getBaseUrl(req);

  // Handle CORS preflight explicitly if reached
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, WWW-Authenticate");
    res.status(204).end();
    return;
  }

  const userCtx = await resolveUserFromAuthHeader(req);

  if (!userCtx) {
    res.setHeader(
      "WWW-Authenticate",
      `Bearer realm="LifeOS MCP", resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`
    );
    res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Unauthorized: Missing or invalid authentication token. Provide a valid Bearer token or Clerk session.",
      },
      id: req.body?.id ?? null,
    });
    return;
  }

  // Preserve or establish MCP session ID
  const sessionId = req.headers["mcp-session-id"] || randomUUID();
  res.setHeader("Mcp-Session-Id", sessionId as string);

  // Execute inside authenticated context
  await runWithAuth(userCtx, async () => {
    // If GET request, return MCP endpoint info and capability description
    if (req.method === "GET") {
      res.setHeader("Content-Type", "application/json");
      res.json({
        name: "LifeOS Personal Career & Life Operating System",
        version: "1.0.0",
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        toolsCount: LIFEOS_MCP_TOOLS.length,
        authenticatedUser: {
          userId: userCtx.userId,
          timezone: userCtx.timezone,
          authMethod: userCtx.authMethod,
        },
      });
      return;
    }

    // Handle JSON-RPC 2.0 messages (POST)
    const body = req.body;
    if (!body || typeof body !== "object") {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32700, message: "Parse error: Invalid JSON payload." },
        id: null,
      });
      return;
    }

    const { id, method, params } = body;

    // Handle JSON-RPC methods
    switch (method) {
      case "initialize":
        res.json({
          jsonrpc: "2.0",
          id: id ?? 1,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: "LifeOS Personal Career & Life Operating System",
              version: "1.0.0",
            },
          },
        });
        return;

      case "notifications/initialized":
        // Notification from client indicating initialization complete
        res.status(204).end();
        return;

      case "ping":
        res.json({
          jsonrpc: "2.0",
          id: id ?? 1,
          result: {},
        });
        return;

      case "tools/list":
        res.json({
          jsonrpc: "2.0",
          id: id ?? 1,
          result: {
            tools: LIFEOS_MCP_TOOLS,
          },
        });
        return;

      case "tools/call": {
        const toolName = params?.name;
        const toolArgs = params?.arguments ?? {};

        if (!toolName) {
          res.json({
            jsonrpc: "2.0",
            id: id ?? 1,
            error: { code: -32602, message: "Invalid params: Missing tool name." },
          });
          return;
        }

        const toolResult = await dispatchMcpTool(toolName, toolArgs);
        res.json({
          jsonrpc: "2.0",
          id: id ?? 1,
          result: toolResult,
        });
        return;
      }

      default:
        res.json({
          jsonrpc: "2.0",
          id: id ?? 1,
          error: { code: -32601, message: `Method not found: "${method}"` },
        });
        return;
    }
  });
}

// Mount handler on both /mcp and /api/mcp for maximum platform compatibility
router.all("/mcp", mcpRateLimiter, handleMcpRequest);
router.all("/api/mcp", mcpRateLimiter, handleMcpRequest);

export default router;
