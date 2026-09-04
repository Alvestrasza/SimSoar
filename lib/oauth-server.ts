import crypto from "node:crypto";
import {prisma} from "@/lib/db";
import {writeAuditLog} from "@/lib/audit";
import {FixedWindowRateLimiter, rateLimitHeaders} from "@/lib/public-api";
import {OAuthPolicyError, readBearerToken, requireOAuthScope, validateOAuthClaims, type OAuthTokenClaims, type SimSoarOAuthScope} from "@/lib/oauth-policy";

type JwtHeader = {alg?: unknown; kid?: unknown; typ?: unknown};
type JsonWebKeyWithKid = JsonWebKey & {kid?: string; alg?: string; use?: string};
type OAuthContext = {userId: string; userEmail: string | null; clientDbId: string; clientId: string; scopes: SimSoarOAuthScope[]};

const globalOAuth = globalThis as typeof globalThis & {
  simSoarOAuthJwks?: Map<string, {expiresAt: number; keys: JsonWebKeyWithKid[]}>;
  simSoarOAuthRateLimiter?: FixedWindowRateLimiter;
};
const jwksCache = globalOAuth.simSoarOAuthJwks ??= new Map();
const oauthRateLimiter = globalOAuth.simSoarOAuthRateLimiter ??= new FixedWindowRateLimiter(300, 60_000, 20_000);

function decodeJsonPart<T>(part: string): T {
  if (!/^[A-Za-z0-9_-]+$/.test(part) || part.length > 16_384) throw new OAuthPolicyError("invalid_token");
  try { return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as T; } catch { throw new OAuthPolicyError("invalid_token"); }
}

async function loadJwks(issuer: string) {
  const uri = process.env.SIMSOAR_OAUTH_JWKS_URI || `${issuer.replace(/\/$/, "")}/protocol/openid-connect/certs`;
  const cached = jwksCache.get(uri);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;
  const response = await fetch(uri, {headers: {accept: "application/json"}, cache: "no-store", signal: AbortSignal.timeout(5_000)});
  if (!response.ok) throw new OAuthPolicyError("invalid_token");
  const body = await response.json() as {keys?: unknown};
  if (!Array.isArray(body.keys) || body.keys.length > 20) throw new OAuthPolicyError("invalid_token");
  const keys = body.keys.filter((key): key is JsonWebKeyWithKid => Boolean(key && typeof key === "object"));
  jwksCache.set(uri, {expiresAt: Date.now() + 300_000, keys});
  return keys;
}

async function verifyAccessToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new OAuthPolicyError("invalid_token");
  const header = decodeJsonPart<JwtHeader>(parts[0]);
  const claims = decodeJsonPart<OAuthTokenClaims>(parts[1]);
  if (header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid || header.kid.length > 255) throw new OAuthPolicyError("invalid_token");
  const issuer = process.env.AUTH_KEYCLOAK_ISSUER?.replace(/\/$/, "");
  const audience = process.env.SIMSOAR_OAUTH_AUDIENCE;
  if (!issuer || !audience) throw new OAuthPolicyError("oauth_not_configured");
  const key = (await loadJwks(issuer)).find((candidate: JsonWebKeyWithKid) => candidate.kid === header.kid && (!candidate.alg || candidate.alg === "RS256") && (!candidate.use || candidate.use === "sig"));
  if (!key) throw new OAuthPolicyError("invalid_token");
  let publicKey: crypto.KeyObject;
  try { publicKey = crypto.createPublicKey({key, format: "jwk"}); } catch { throw new OAuthPolicyError("invalid_token"); }
  const signatureValid = crypto.verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`, "ascii"), publicKey, Buffer.from(parts[2], "base64url"));
  if (!signatureValid) throw new OAuthPolicyError("invalid_token");
  return validateOAuthClaims(claims, issuer, audience);
}

export async function authenticateOAuthRequest(request: Request, requiredScope: SimSoarOAuthScope): Promise<{context: OAuthContext; rateLimit: ReturnType<FixedWindowRateLimiter["consume"]>}> {
  const token = readBearerToken(request);
  const verified = await verifyAccessToken(token);
  const client = await prisma.oAuthClient.findUnique({where: {clientId: verified.clientId}});
  if (!client || client.status !== "APPROVED" || !client.consentRequired) throw new OAuthPolicyError("client_not_approved");
  requireOAuthScope(verified.scopes, client.allowedScopes, requiredScope);
  const account = await prisma.account.findUnique({where: {provider_providerAccountId: {provider: "keycloak", providerAccountId: verified.subject}}, select: {user: {select: {id: true, email: true}}}});
  if (!account) throw new OAuthPolicyError("unknown_subject");
  const existingGrant = await prisma.oAuthGrant.findUnique({where: {userId_oauthClientId: {userId: account.user.id, oauthClientId: client.id}}});
  if (existingGrant?.revokedAt) throw new OAuthPolicyError("grant_revoked");
  const scopes = verified.scopes.filter((scope) => client.allowedScopes.includes(scope));
  if (existingGrant) {
    await prisma.oAuthGrant.update({where: {id: existingGrant.id}, data: {scopes, lastUsedAt: new Date()}});
  } else {
    await prisma.oAuthGrant.create({data: {userId: account.user.id, oauthClientId: client.id, scopes}});
    await writeAuditLog({actorUserId: account.user.id, actorEmail: account.user.email, action: "OAUTH_GRANT_USE", targetType: "OAuthClient", targetId: client.id, summary: "An approved OAuth grant was first used.", metadata: {clientId: client.clientId, scopes}});
  }
  const rateLimit = oauthRateLimiter.consume(`${client.id}:${account.user.id}`);
  if (!rateLimit.allowed) throw new OAuthPolicyError("rate_limit_exceeded");
  return {context: {userId: account.user.id, userEmail: account.user.email, clientDbId: client.id, clientId: client.clientId, scopes}, rateLimit};
}

export function oauthApiJson(body: unknown, options: {status?: number; rateLimit?: ReturnType<FixedWindowRateLimiter["consume"]>; replayed?: boolean} = {}) {
  return Response.json(body, {status: options.status ?? 200, headers: {
    "Cache-Control": "no-store", "X-API-Version": "1", "X-Content-Type-Options": "nosniff",
    ...(options.replayed ? {"Idempotency-Replayed": "true"} : {}), ...rateLimitHeaders(options.rateLimit)
  }});
}

export function oauthApiError(error: unknown, requiredScope?: SimSoarOAuthScope) {
  const code = error instanceof OAuthPolicyError ? error.code : "invalid_token";
  const status = code === "insufficient_scope" || code === "client_not_approved" || code === "grant_revoked" ? 403 : code === "rate_limit_exceeded" ? 429 : 401;
  const publicCode = status === 401 ? "invalid_token" : code;
  const challenge = status === 401 ? 'Bearer realm="simsoar-api", error="invalid_token"' : status === 403 && requiredScope ? `Bearer realm="simsoar-api", error="insufficient_scope", scope="${requiredScope}"` : null;
  return Response.json({error: {code: publicCode, message: status === 403 ? "The client is not authorized for this operation." : status === 429 ? "Too many requests." : "A valid bearer access token is required."}}, {status, headers: {"Cache-Control": "no-store", "X-API-Version": "1", "X-Content-Type-Options": "nosniff", ...(challenge ? {"WWW-Authenticate": challenge} : {})}});
}
