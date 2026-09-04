# OAuth integrations and protected API

SimSoar uses the existing Keycloak realm as its only OAuth 2.0 authorization server. SimSoar is a resource server: it validates signed access tokens and applies a second, application-level allowlist of reviewed clients and scopes. It never accepts user passwords, issues tokens, or stores external client secrets.

The implementation follows the [OAuth 2.0 Security Best Current Practice (RFC 9700)](https://www.rfc-editor.org/rfc/rfc9700.html), [PKCE (RFC 7636)](https://www.rfc-editor.org/rfc/rfc7636.html), [OAuth token revocation (RFC 7009)](https://www.rfc-editor.org/rfc/rfc7009.html), and the [OAuth native-app guidance (RFC 8252)](https://www.rfc-editor.org/rfc/rfc8252.html).

## Scopes

| Scope | Meaning | Current API |
| --- | --- | --- |
| `profile.read` | Read the authenticated user's basic profile | `GET /api/v1/me` |
| `public.read` | Identify clients that consume public catalog data | Existing public GET endpoints remain anonymous |
| `tasks.private.read` | Read the user's own tasks | `GET /api/v1/tasks`, `GET /api/v1/tasks/{id}` |
| `tasks.write` | Create tasks for the user | `POST /api/v1/tasks` |
| `flights.upload` | Reserved for an explicit future upload endpoint | No endpoint is enabled yet |
| `events.manage` | Reserved for steward-approved event operations | No endpoint is enabled yet |

Reserved scopes grant no access until a dedicated endpoint and policy are shipped. Administrative website roles do not bypass OAuth endpoint scopes.

## Client registration and review

An administrator must first configure the client in Keycloak and then register the same public client ID in SimSoar's OAuth client registry. Approval requires:

- Authorization Code flow only; implicit and resource-owner password grants disabled;
- PKCE with `S256` required for public/native clients;
- explicit consent enabled, with a plain-language description for every requested scope;
- exact redirect URIs, with no wildcard; HTTPS except literal `127.0.0.1` or `[::1]` loopback redirects for native clients;
- an audience mapper that adds the configured `SIMSOAR_OAUTH_AUDIENCE` to access tokens;
- short-lived signed RS256 access tokens containing `iss`, `sub`, `aud`, `azp`, `iat`, `exp`, and `scope`;
- only the scopes reviewed in the SimSoar registry.

Redirects are validated both when registered and by Keycloak during authorization. A token is accepted only when its signature, issuer, audience, timestamps, client, local review status, local grant state, requested endpoint scope, and client allowlist all pass.

## Consent and revocation

Keycloak displays and records the authoritative user consent. On first successful API use, SimSoar records only the client, user, approved SimSoar scopes, and timestamps so the user can inspect and locally revoke the connection under **My Profile → Connected applications**. A local revocation fails closed even if an upstream token is still valid. The identity-provider account link lets the user also revoke the upstream session or consent.

Administrators can suspend or revoke a client immediately. Incident handling should perform both actions: revoke or suspend the SimSoar registry entry first, then revoke the Keycloak client's active sessions and credentials. Re-enable only after new credentials and redirect review.

## Refresh tokens

SimSoar's protected API never receives or stores refresh tokens. Keycloak owns refresh-token expiry, rotation, reuse detection, and revocation. Clients must store tokens in operating-system protected storage, rotate refresh tokens on every use, reject reuse, and erase them on disconnect. Access tokens, refresh tokens, authorization codes, client secrets, and raw authorization headers must never enter application logs or diagnostic bundles.

## API behavior

All protected endpoints are versioned below `/api/v1`, return `X-API-Version: 1`, and use `Cache-Control: no-store`. Bearer tokens are accepted only in the `Authorization` header; cookies do not authenticate these endpoints. Responses use fixed error messages and never echo credentials.

Mutating endpoints require `Content-Type: application/json` and an `Idempotency-Key` of 8–128 safe characters. Keys are scoped to client and user, retained for 24 hours, and bound to a hash of method, path, user, and exact body. Repeating the same request returns the stored response; reusing the key with different content returns a conflict. A maintenance job may delete expired records.

Rate limits are applied per reviewed client and user. Security audit records identify the public client ID, effective scopes, action, user, and target, but contain no tokens, authorization codes, secrets, request bodies, or private task contents.

## First-party clients

The future SimSoar desktop companion must be registered, consented, rate-limited, audited, and scoped exactly like any third-party public client. It receives no private API or role bypass. Signed application updates and local filesystem permissions are separate controls and do not expand OAuth authority.
