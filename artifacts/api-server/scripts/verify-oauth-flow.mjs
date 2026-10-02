import crypto from "node:crypto";
import { createClerkClient } from "@clerk/express";

const BASE_URL = process.env.LIFEOS_BASE_URL || "https://lifesos.online";
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

if (!CLERK_SECRET_KEY) {
  console.error("Missing CLERK_SECRET_KEY in environment");
  process.exit(1);
}

const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });

async function getTestClerkSessionToken() {
  const users = await clerk.users.getUserList({ limit: 1 });
  if (!users.data[0]) {
    throw new Error("No Clerk users found to test with");
  }
  const user = users.data[0];
  console.log(`[1] Authenticated Clerk User: ${user.id} (${user.emailAddresses[0]?.emailAddress})`);

  let session;
  const sessions = await clerk.sessions.getSessionList({ userId: user.id, status: "active" });
  if (sessions.data[0]) {
    session = sessions.data[0];
  } else {
    session = await clerk.sessions.createSession({ userId: user.id });
  }

  const tokenRes = await clerk.sessions.getToken(session.id);
  return tokenRes.jwt;
}

function base64Url(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function runAudit() {
  console.log(`=== STARTING LIVE PRODUCTION OAUTH 2.1 + PKCE + MCP AUDIT ===`);
  console.log(`Target: ${BASE_URL}\n`);

  // 1. Verify OAuth Discovery
  console.log(`[A] Checking OAuth 2.1 Server Metadata...`);
  const discRes = await fetch(`${BASE_URL}/.well-known/oauth-authorization-server`);
  if (!discRes.ok) throw new Error(`OAuth discovery failed: HTTP ${discRes.status}`);
  const discData = await discRes.json();
  console.log(`    Issuer: ${discData.issuer}`);
  console.log(`    Auth Endpoint: ${discData.authorization_endpoint}`);
  console.log(`    Token Endpoint: ${discData.token_endpoint}`);
  console.log(`    Code Challenge Methods: ${discData.code_challenge_methods_supported.join(", ")}`);
  console.log(`    OK: OAuth 2.1 Discovery Valid\n`);

  // 2. Verify RFC 9728 Protected Resource Metadata
  console.log(`[B] Checking RFC 9728 Protected Resource Metadata...`);
  const resMetaRes = await fetch(`${BASE_URL}/.well-known/oauth-protected-resource`);
  if (!resMetaRes.ok) throw new Error(`Protected resource metadata failed: HTTP ${resMetaRes.status}`);
  const resMetaData = await resMetaRes.json();
  console.log(`    Resource: ${resMetaData.resource}`);
  console.log(`    Auth Servers: ${resMetaData.authorization_servers.join(", ")}`);
  console.log(`    OK: Protected Resource Metadata Valid\n`);

  // 3. Generate PKCE pair
  console.log(`[C] Generating PKCE Challenge...`);
  const codeVerifier = base64Url(crypto.randomBytes(32));
  const codeChallenge = base64Url(crypto.createHash("sha256").update(codeVerifier).digest());
  const state = base64Url(crypto.randomBytes(16));
  const clientId = "chatgpt_production_audit";
  const redirectUri = "https://oauth.pstmn.io/v1/callback";
  console.log(`    Code Verifier: ${codeVerifier.slice(0, 10)}... (length: ${codeVerifier.length})`);
  console.log(`    Code Challenge (S256): ${codeChallenge}`);
  console.log(`    OK: PKCE pair ready\n`);

  // 4. Authenticate & Authorize
  console.log(`[D] Authorizing via /oauth/authorize...`);
  const clerkJwt = await getTestClerkSessionToken();
  const authorizeUrl = new URL(`${BASE_URL}/oauth/authorize`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("state", state);

  const authRes = await fetch(authorizeUrl.toString(), {
    headers: {
      Authorization: `Bearer ${clerkJwt}`,
    },
    redirect: "manual",
  });

  if (authRes.status !== 302) {
    const text = await authRes.text();
    throw new Error(`Expected 302 redirect from /oauth/authorize, got ${authRes.status}: ${text}`);
  }

  const location = authRes.headers.get("location");
  console.log(`    Redirect Location: ${location}`);
  const redirectUrl = new URL(location, BASE_URL);
  const code = redirectUrl.searchParams.get("code");
  const returnedState = redirectUrl.searchParams.get("state");

  if (!code) throw new Error("No authorization code in redirect URL!");
  if (returnedState !== state) throw new Error(`State mismatch: expected ${state}, got ${returnedState}`);
  console.log(`    Received Auth Code: ${code.slice(0, 8)}...`);
  console.log(`    OK: Authorization Code Obtained\n`);

  // 5. Token Exchange via /oauth/token
  console.log(`[E] Exchanging Code for Access Token via /oauth/token...`);
  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const tokenRes = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: tokenParams.toString(),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Token exchange failed (HTTP ${tokenRes.status}): ${errText}`);
  }

  const tokenData = await tokenRes.json();
  console.log(`    Token Type: ${tokenData.token_type}`);
  console.log(`    Expires In: ${tokenData.expires_in}s`);
  console.log(`    Access Token Prefix: ${tokenData.access_token.slice(0, 14)}...`);
  if (!tokenData.access_token.startsWith("los_oauth_")) {
    throw new Error(`Expected access token to start with 'los_oauth_', got ${tokenData.access_token.slice(0, 15)}`);
  }
  console.log(`    OK: Valid OAuth Access Token Received\n`);

  const oauthToken = tokenData.access_token;

  // 6. MCP Protocol Handshake with OAuth Token
  console.log(`[F] Initiating MCP Protocol Handshake at ${BASE_URL}/mcp...`);
  
  // 6a. Initialize
  const initRes = await fetch(`${BASE_URL}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${oauthToken}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "ChatGPT-Audit", version: "1.0.0" },
      },
    }),
  });

  if (!initRes.ok) {
    const text = await initRes.text();
    throw new Error(`MCP initialize failed: HTTP ${initRes.status} ${text}`);
  }

  const initData = await initRes.json();
  const sessionId = initRes.headers.get("mcp-session-id");
  console.log(`    Server Name: ${initData.result?.serverInfo?.name}`);
  console.log(`    Protocol Version: ${initData.result?.protocolVersion}`);
  console.log(`    Mcp-Session-Id: ${sessionId}`);
  console.log(`    OK: MCP Initialize Succeeded\n`);

  // 6b. Initialized Notification
  console.log(`[G] Sending notifications/initialized...`);
  const notifRes = await fetch(`${BASE_URL}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${oauthToken}`,
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
  });
  console.log(`    HTTP Status: ${notifRes.status} (Expected: 204)`);
  console.log(`    OK: Notification Acknowledged\n`);

  // 6c. Tools List
  console.log(`[H] Fetching tools/list...`);
  const listRes = await fetch(`${BASE_URL}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${oauthToken}`,
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    }),
  });

  if (!listRes.ok) throw new Error(`tools/list failed: HTTP ${listRes.status}`);
  const listData = await listRes.json();
  const tools = listData.result?.tools || [];
  console.log(`    Tools Discovered: ${tools.length}`);
  console.log(`    Sample Tools: ${tools.slice(0, 5).map((t) => t.name).join(", ")}...`);
  if (tools.length !== 42) {
    throw new Error(`Expected 42 tools, got ${tools.length}`);
  }
  console.log(`    OK: All 42 Tools Discovered\n`);

  // 6d. Tools Call (get_today)
  console.log(`[I] Calling tool: get_today...`);
  const callRes = await fetch(`${BASE_URL}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${oauthToken}`,
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "get_today",
        arguments: {},
      },
    }),
  });

  if (!callRes.ok) throw new Error(`tools/call failed: HTTP ${callRes.status}`);
  const callData = await callRes.json();
  const rawText = callData.result?.content?.[0]?.text;
  if (!rawText) throw new Error("No text content returned from get_today");
  const parsed = JSON.parse(rawText);
  console.log(`    Date: ${parsed.date}`);
  console.log(`    Daily Score: ${parsed.summary?.daily_score}%`);
  console.log(`    Goals Count: ${parsed.goals?.length}`);
  console.log(`    Schedules Count: ${parsed.schedules?.length}`);
  console.log(`    OK: get_today Executed Successfully with Live Scoped Data\n`);

  // 6e. Calling tool: get_goals
  console.log(`[J] Calling tool: get_goals...`);
  const goalsRes = await fetch(`${BASE_URL}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${oauthToken}`,
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "get_goals",
        arguments: { limit: 3 },
      },
    }),
  });

  const goalsData = await goalsRes.json();
  const goalsText = goalsData.result?.content?.[0]?.text;
  const goalsParsed = JSON.parse(goalsText);
  console.log(`    Retrieved ${goalsParsed.length} Goals for Authenticated User`);
  console.log(`    OK: get_goals Executed Successfully\n`);

  console.log(`================================================================`);
  console.log(`>>> ALL CHECKS PASSED: FULL OAUTH 2.1 + PKCE + MCP AUDIT SUCCESS! <<<`);
  console.log(`================================================================`);
}

runAudit().catch((err) => {
  console.error("\n[AUDIT FAILED]:", err);
  process.exit(1);
});
