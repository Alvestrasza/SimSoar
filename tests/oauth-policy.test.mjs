import assert from "node:assert/strict";
import test from "node:test";
import {OAuthPolicyError, hashIdempotentRequest, idempotencyDecision, normalizeOAuthScopes, normalizeRedirectUris, readBearerToken, redirectUriMatches, requireOAuthScope, validateIdempotencyKey, validateOAuthClaims} from "../lib/oauth-policy.ts";

function expectCode(callback, code) { assert.throws(callback, (error) => error instanceof OAuthPolicyError && error.code === code); }

test("accepts exact HTTPS and literal loopback redirects", () => {
  const registered = normalizeRedirectUris("https://client.example/callback\nhttp://127.0.0.1:49152/callback");
  assert.equal(redirectUriMatches(registered, "https://client.example/callback"), true);
  assert.equal(redirectUriMatches(registered, "https://client.example/other"), false);
});

test("rejects wildcard, fragment, credentials, and insecure redirects", () => {
  for (const value of ["https://*.example/cb", "https://client.example/cb#fragment", "https://user:pass@client.example/cb", "http://client.example/cb", "http://localhost/cb"]) expectCode(() => normalizeRedirectUris(value), "invalid_redirect_uri");
});

test("prevents scope escalation beyond token and registered client", () => {
  const token = normalizeOAuthScopes(["profile.read", "tasks.write", "unknown"]);
  requireOAuthScope(token, ["profile.read"], "profile.read");
  expectCode(() => requireOAuthScope(token, ["profile.read"], "tasks.write"), "insufficient_scope");
  expectCode(() => requireOAuthScope(["profile.read"], ["profile.read", "tasks.write"], "tasks.write"), "insufficient_scope");
});

test("cookies cannot authenticate a protected bearer API", () => {
  expectCode(() => readBearerToken(new Request("https://api.example/v1/me", {headers: {cookie: "session=secret"}})), "missing_bearer_token");
  assert.equal(readBearerToken(new Request("https://api.example/v1/me", {headers: {authorization: "Bearer a.b.c"}})), "a.b.c");
});

test("idempotency replays only the identical request", () => {
  const hash = hashIdempotentRequest("POST", "/api/v1/tasks", "user-1", "{\"name\":\"A\"}");
  assert.deepEqual(idempotencyDecision(null, hash), {kind: "new"});
  assert.equal(idempotencyDecision({requestHash: hash, responseStatus: 201, responseBody: {id: "task-1"}}, hash).kind, "replay");
  expectCode(() => idempotencyDecision({requestHash: "other", responseStatus: 201, responseBody: {}}, hash), "idempotency_key_reused");
  assert.equal(validateIdempotencyKey("request-12345678"), "request-12345678");
});

test("fixed policy errors never include presented bearer credentials", () => {
  const credential = "secret-token-value";
  let error;
  try { readBearerToken(new Request("https://api.example/v1/me", {headers: {authorization: `Basic ${credential}`}})); } catch (caught) { error = caught; }
  assert.equal(String(error).includes(credential), false);
});

test("validates issuer, audience, lifetime, subject, and authorized client", () => {
  const claims = {iss: "https://identity.example/realms/test", sub: "user-1", aud: ["account", "simsoar-api"], azp: "desktop-client", iat: 990, exp: 1100, scope: "openid profile.read"};
  assert.deepEqual(validateOAuthClaims(claims, claims.iss, "simsoar-api", 1000), {subject: "user-1", clientId: "desktop-client", scopes: ["profile.read"]});
  expectCode(() => validateOAuthClaims({...claims, aud: "other"}, claims.iss, "simsoar-api", 1000), "invalid_token");
  expectCode(() => validateOAuthClaims({...claims, exp: 900}, claims.iss, "simsoar-api", 1000), "invalid_token");
});
