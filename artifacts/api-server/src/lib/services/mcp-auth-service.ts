import { randomBytes, createHash } from "node:crypto";
import { and, desc, eq, gt, lte } from "drizzle-orm";
import { db, mcpTokensTable, mcpOauthCodesTable } from "@workspace/db";

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sha256Base64Url(str: string): string {
  const hash = createHash("sha256").update(str).digest();
  return base64UrlEncode(hash);
}

export async function generateMcpToken(
  userId: number,
  name = "ChatGPT MCP Access Token",
  expiresInDays = 365,
) {
  const rawBytes = randomBytes(24).toString("hex");
  const rawToken = `los_mcp_${rawBytes}`;
  const tokenHash = hashToken(rawToken);
  const tokenPrefix = `los_mcp_${rawBytes.slice(0, 6)}...`;

  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  const [tokenRecord] = await db
    .insert(mcpTokensTable)
    .values({
      userId,
      name,
      tokenHash,
      tokenPrefix,
      scopes: "all",
      expiresAt,
    })
    .returning();

  return {
    id: tokenRecord.id,
    name: tokenRecord.name,
    rawToken, // displayed to the user ONCE
    tokenPrefix: tokenRecord.tokenPrefix,
    expiresAt: tokenRecord.expiresAt?.toISOString(),
    createdAt: tokenRecord.createdAt.toISOString(),
  };
}

export async function listMcpTokens(userId: number) {
  const list = await db
    .select({
      id: mcpTokensTable.id,
      name: mcpTokensTable.name,
      tokenPrefix: mcpTokensTable.tokenPrefix,
      scopes: mcpTokensTable.scopes,
      expiresAt: mcpTokensTable.expiresAt,
      lastUsedAt: mcpTokensTable.lastUsedAt,
      createdAt: mcpTokensTable.createdAt,
    })
    .from(mcpTokensTable)
    .where(eq(mcpTokensTable.userId, userId))
    .orderBy(desc(mcpTokensTable.createdAt));

  return list;
}

export async function revokeMcpToken(userId: number, tokenId: number) {
  const [deleted] = await db
    .delete(mcpTokensTable)
    .where(and(eq(mcpTokensTable.id, tokenId), eq(mcpTokensTable.userId, userId)))
    .returning({ id: mcpTokensTable.id, name: mcpTokensTable.name });

  if (!deleted) {
    throw new Error(`Token ${tokenId} not found or unauthorized.`);
  }

  return { success: true, message: `Token "${deleted.name}" revoked.` };
}

export async function createAuthorizationCode(data: {
  userId: number;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod?: string;
}) {
  const code = randomBytes(24).toString("hex");
  // 10 minutes expiry
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const [created] = await db
    .insert(mcpOauthCodesTable)
    .values({
      code,
      userId: data.userId,
      clientId: data.clientId,
      redirectUri: data.redirectUri,
      codeChallenge: data.codeChallenge,
      codeChallengeMethod: data.codeChallengeMethod || "S256",
      expiresAt,
    })
    .returning();

  return created.code;
}

export async function generateOAuthToken(
  userId: number,
  clientId: string,
  scope = "all",
  expiresInDays = 30,
) {
  const rawBytes = randomBytes(24).toString("hex");
  const rawToken = `los_oauth_${rawBytes}`;
  const tokenHash = hashToken(rawToken);
  const tokenPrefix = `los_oauth_${rawBytes.slice(0, 6)}...`;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  const [tokenRecord] = await db
    .insert(mcpTokensTable)
    .values({
      userId,
      name: `OAuth Client (${clientId || "ChatGPT"})`,
      tokenHash,
      tokenPrefix,
      scopes: scope,
      expiresAt,
    })
    .returning();

  return {
    id: tokenRecord.id,
    rawToken,
    expiresAt: tokenRecord.expiresAt?.toISOString(),
  };
}

export async function exchangeAuthorizationCode(data: {
  code: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  codeVerifier?: string;
}) {
  const now = new Date();

  // 1. Find authorization code
  const [record] = await db
    .select()
    .from(mcpOauthCodesTable)
    .where(and(eq(mcpOauthCodesTable.code, data.code), gt(mcpOauthCodesTable.expiresAt, now)))
    .limit(1);

  if (!record) {
    throw new Error("Invalid or expired authorization code.");
  }

  // 2. Validate redirect_uri and client_id if provided
  if (data.redirectUri && record.redirectUri !== data.redirectUri) {
    throw new Error("redirect_uri mismatch.");
  }
  if (data.clientId && record.clientId && record.clientId !== data.clientId) {
    throw new Error("client_id mismatch.");
  }

  // 3. Verify PKCE S256 code challenge if one was used during authorization
  if (record.codeChallenge) {
    if (!data.codeVerifier) {
      throw new Error("Missing code_verifier for PKCE code exchange.");
    }
    const calculatedChallenge = sha256Base64Url(data.codeVerifier);
    if (calculatedChallenge !== record.codeChallenge) {
      throw new Error("PKCE verification failed: code_verifier does not match code_challenge.");
    }
  }

  // 4. One-time code use: delete the authorization code
  await db.delete(mcpOauthCodesTable).where(eq(mcpOauthCodesTable.id, record.id));

  // 5. Generate dedicated OAuth Access Token
  const token = await generateOAuthToken(record.userId, record.clientId, "all", 30);

  return {
    access_token: token.rawToken,
    token_type: "Bearer",
    expires_in: 30 * 24 * 60 * 60,
    scope: "all",
  };
}

export interface RegisteredOAuthClient {
  clientId: string;
  clientSecret: string;
  clientName: string;
  redirectUris: string[];
  grantTypes: string[];
  responseTypes: string[];
  tokenEndpointAuthMethod: string;
  createdAt: number;
}

const registeredClients = new Map<string, RegisteredOAuthClient>();

export function registerOAuthClient(params: {
  client_name?: string;
  redirect_uris?: string[];
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string;
  scope?: string;
}) {
  const clientId = `los_client_${randomBytes(16).toString("hex")}`;
  const clientSecret = `los_secret_${randomBytes(24).toString("hex")}`;
  const now = Math.floor(Date.now() / 1000);

  const client: RegisteredOAuthClient = {
    clientId,
    clientSecret,
    clientName: params.client_name || "Google Gemini / MCP Client",
    redirectUris: params.redirect_uris || [],
    grantTypes: params.grant_types || ["authorization_code", "refresh_token"],
    responseTypes: params.response_types || ["code"],
    tokenEndpointAuthMethod: params.token_endpoint_auth_method || "none",
    createdAt: now,
  };

  registeredClients.set(clientId, client);

  return {
    client_id: clientId,
    client_secret: clientSecret,
    client_id_issued_at: now,
    client_secret_expires_at: 0,
    client_name: client.clientName,
    redirect_uris: client.redirectUris,
    grant_types: client.grantTypes,
    response_types: client.responseTypes,
    token_endpoint_auth_method: client.tokenEndpointAuthMethod,
  };
}

export function getOAuthDiscoveryConfig(baseUrl: string) {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  return {
    issuer: normalizedBase,
    authorization_endpoint: `${normalizedBase}/oauth/authorize`,
    token_endpoint: `${normalizedBase}/oauth/token`,
    registration_endpoint: `${normalizedBase}/oauth/register`,
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["mcp", "read", "write", "all"],
    service_documentation: `${normalizedBase}/docs/mcp`,
    ui_locales_supported: ["en"],
  };
}

export function getOAuthProtectedResourceConfig(baseUrl: string) {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  return {
    resource: `${normalizedBase}/mcp`,
    authorization_servers: [normalizedBase],
    scopes_supported: ["mcp", "read", "write", "all"],
    bearer_methods_supported: ["header"],
    resource_documentation: `${normalizedBase}/docs/mcp`,
  };
}

