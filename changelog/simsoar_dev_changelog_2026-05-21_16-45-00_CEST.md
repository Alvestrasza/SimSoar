# SimSoar DEV Change Log – 2026-05-21 16:45:00 CEST

## Version

- Previous version: `0.1.4`
- New version: `0.1.5`
- Environment: `dev`

## Changes

### Home Map Preview

- Removed the visible Leaflet popup from the start page map preview.
- Removed the large informational overlay from the start page map preview.
- The map now only displays the map section, marker, and optional browser accuracy circle.
- IP-based fallback location is still used internally, but city/country information is no longer displayed to normal users.
- Disabled the Leaflet attribution and popup display inside the start page preview container.

### Pilots Page

- Reworked the pilots ranking page to aggregate directly from public flight data instead of nested `PilotProfile -> User -> Flight` relations.
- This avoids crashes caused by inconsistent or incomplete profile/user relation data after Keycloak login.
- Added server-side error handling so the page renders a controlled message instead of a Next.js production error page if the database query fails.
- Kept the page public and dynamic.

### Authentication Resilience

- Wrapped global session loading in the root layout with a guarded `try/catch`.
- Public pages can now continue to render even if session loading fails temporarily after an authentication callback.

## Notes

- The visible user-facing location text was intentionally removed for privacy and UI clarity.
- A future version should replace free-text home airfield geocoding with a structured airport table using ICAO/4-letter codes and stored coordinates.
