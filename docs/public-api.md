# SimSoar public API v1

SimSoar exposes a read-only JSON API for approved public data. Private, unlisted, moderated, and deleted flights are excluded at the database query boundary. The API never exposes email addresses, IGC object paths, file hashes, moderation notes, or account data.

## Endpoints

- `GET /api/v1` lists the available endpoints.
- `GET /api/v1/flights?page=1&limit=25` lists public flights. `limit` is capped at 100.
- `GET /api/v1/flights/{id}` returns one public flight and a route simplified to at most 600 points.
- `GET /api/v1/pilots?page=1&limit=25` lists pilots who have public flights and their public aggregates.
- `GET /api/v1/rankings?page=1&limit=25` ranks pilots by total public OLC points.

Successful list responses contain `data` and `pagination`. Errors use `{ "error": { "code": "...", "message": "..." } }`. Timestamps are ISO 8601 strings and distances use kilometres.

## Rate limiting and caching

Anonymous requests are limited per observed client address. The defaults are 120 requests per 60 seconds and can be changed with `PUBLIC_API_RATE_LIMIT` and `PUBLIC_API_RATE_WINDOW_SECONDS`. Every response includes `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`; rejected requests return HTTP 429 and `Retry-After`.

The limiter is deliberately process-local. Deployments with multiple application instances should enforce a second shared limit at the reverse proxy or replace the limiter with a shared store. The application prefers the reverse proxy's `X-Real-IP` value. Direct public access to the application port is not supported.

Responses allow cross-origin reads and use `Cache-Control: no-store` so personalized rate-limit metadata is never shared by an intermediary cache. API keys may be added in a later API version without changing the current anonymous response contract.
