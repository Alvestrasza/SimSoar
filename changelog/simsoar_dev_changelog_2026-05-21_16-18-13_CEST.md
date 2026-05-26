---
title: SimSoar DEV Change Log
version: 0.1.4
created: 2026-05-21 16:18:13 CEST
modified: 2026-05-21 16:18:13 CEST
environment: dev
copyright: Tim Richter
---

# SimSoar DEV Change Log – v0.1.4

## Summary

This release adds visible site versioning, copyright information, a home-page location map preview, and a user profile preference for using the configured home airfield as the preferred home-page map location.

## Changed Files

- `app/layout.tsx`
  - Added global footer.
  - Footer displays copyright holder and application version.
- `lib/site.ts`
  - Added central site constants for version and copyright holder.
- `app/page.tsx`
  - Replaced static home-page map placeholder with interactive location preview.
  - Loads the authenticated user's home airfield preference when available.
- `app/components/HomeMapPreview.tsx`
  - Added browser geolocation support.
  - Added IP-based fallback location lookup.
  - Added optional home-airfield display using profile data.
  - Added manual map buttons for current location and home airfield.
- `app/profile/page.tsx`
  - Added profile checkbox: "Heimatflugplatz auf der Startseiten-Karte bevorzugen".
- `app/profile/save-profile-action.ts`
  - Persists the new profile map preference.
- `prisma/schema.prisma`
  - Added `PilotProfile.showHomeAirfieldOnHome`.
- `prisma/migrations/20260521162000_add_home_map_preference/migration.sql`
  - Adds the new Boolean column to existing databases.
- `app/globals.css`
  - Added footer, home map preview and profile checkbox styling.
- `package.json`
  - Updated version to `0.1.4`.
- `package-lock.json`
  - Updated package version metadata to `0.1.4`.

## Behaviour

1. If the profile option is enabled and a home airfield is configured, the home-page map first tries to show the home airfield.
2. Otherwise, the browser geolocation API is used.
3. If the browser location is denied or unavailable, the page uses an IP-based approximate fallback.
4. If IP lookup fails and a home airfield exists, the home airfield is used as a final fallback.
5. If no location source is available, the map falls back to a Germany-wide default view.

## Notes

- Browser geolocation requires HTTPS or localhost.
- The IP fallback is approximate and should not be treated as precise navigation data.
- Home-airfield lookup uses public OpenStreetMap/Nominatim geocoding in the browser.
- For production hardening, the external IP/geocoding lookups can later be routed through a backend endpoint or disabled by policy.
