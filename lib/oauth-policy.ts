import crypto from "node:crypto";

export const SIMSOAR_OAUTH_SCOPES = ["profile.read", "public.read", "tasks.private.read", "tasks.write", "flights.upload", "events.manage"] as const;
export type SimSoarOAuthScope = typeof SIMSOAR_OAUTH_SCOPES[number];
export type OAuthTokenClaims = {iss?: unknown; sub?: unknown; aud?: unknown; azp?: unknown; client_id?: unknown; exp?: unknown; nbf?: unknown; iat?: unknown; scope?: unknown};
const scopeSet = new Set<string>(SIMSOAR_OAUTH_SCOPES);

export class OAuthPolicyError extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; }
}

export function normalizeOAuthScopes(values: Iterable<string>): SimSoarOAuthScope[] {
  return [...new Set([...values].map((value) => value.trim()).filter((value): value is SimSoarOAuthScope => scopeSet.has(value)))].sort();
}

export function parseOAuthScopeClaim(value: unknown) {
  return typeof value === "string" ? normalizeOAuthScopes(value.split(/\s+/)) : [];
}

export function validateOAuthClaims(claims: OAuthTokenClaims, issuer: string, audience: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (claims.iss !== issuer || typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 255) throw new OAuthPolicyError("invalid_token");
  const audiences = typeof claims.aud === "string" ? [claims.aud] : Array.isArray(claims.aud) ? claims.aud : [];
  if (!audiences.includes(audience)) throw new OAuthPolicyError("invalid_token");
  if (typeof claims.exp !== "number" || claims.exp <= nowSeconds - 30 || claims.exp > nowSeconds + 86_400) throw new OAuthPolicyError("invalid_token");
  if (typeof claims.nbf === "number" && claims.nbf > nowSeconds + 30) throw new OAuthPolicyError("invalid_token");
  if (typeof claims.iat !== "number" || claims.iat > nowSeconds + 30 || claims.iat < nowSeconds - 86_400) throw new OAuthPolicyError("invalid_token");
  const clientId = typeof claims.azp === "string" ? claims.azp : typeof claims.client_id === "string" ? claims.client_id : null;
  if (!clientId || !/^[A-Za-z0-9._:-]{1,160}$/.test(clientId)) throw new OAuthPolicyError("invalid_token");
  return {subject: claims.sub, clientId, scopes: parseOAuthScopeClaim(claims.scope)};
}

export function requireOAuthScope(tokenScopes: readonly string[], allowedScopes: readonly string[], required: SimSoarOAuthScope) {
  if (!tokenScopes.includes(required) || !allowedScopes.includes(required)) throw new OAuthPolicyError("insufficient_scope");
}

export function normalizeRedirectUris(text: string) {
  const values = [...new Set(text.split(/\r?\n/).map((value) => value.trim()).filter(Boolean))];
  if (!values.length || values.length > 20) throw new OAuthPolicyError("invalid_redirect_uri");
  return values.map((value) => {
    if (value.length > 2048 || value.includes("*")) throw new OAuthPolicyError("invalid_redirect_uri");
    let url: URL;
    try { url = new URL(value); } catch { throw new OAuthPolicyError("invalid_redirect_uri"); }
    const loopback = url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "[::1]");
    if ((url.protocol !== "https:" && !loopback) || url.username || url.password || url.hash) throw new OAuthPolicyError("invalid_redirect_uri");
    return url.toString();
  });
}

export function redirectUriMatches(registered: readonly string[], candidate: string) {
  try { return registered.includes(new URL(candidate).toString()); } catch { return false; }
}

export function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) throw new OAuthPolicyError("missing_bearer_token");
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(authorization);
  if (!match || match[1].length > 8192) throw new OAuthPolicyError("invalid_bearer_token");
  return match[1];
}

export function validateIdempotencyKey(value: string | null) {
  if (!value || !/^[A-Za-z0-9._:-]{8,128}$/.test(value)) throw new OAuthPolicyError("invalid_idempotency_key");
  return value;
}

export function hashIdempotentRequest(method: string, pathname: string, userId: string, body: string) {
  return crypto.createHash("sha256").update(`${method.toUpperCase()}\n${pathname}\n${userId}\n${body}`, "utf8").digest("hex");
}

export function idempotencyDecision(existing: {requestHash: string; responseStatus: number; responseBody: unknown} | null, requestHash: string) {
  if (!existing) return {kind: "new" as const};
  if (existing.requestHash !== requestHash) throw new OAuthPolicyError("idempotency_key_reused");
  return {kind: "replay" as const, status: existing.responseStatus, body: existing.responseBody};
}
