# SimSoar DEV Change Log – 2026-05-21 17:02:43 CEST

## Version

- Previous version: `0.1.5`
- New version: `0.1.6`
- Environment: `DEV`

## Summary

This release stabilizes the Keycloak/Auth.js integration after login and removes authentication checks from the global application layout. The public home page no longer depends on a server-side Auth.js session during initial rendering. Protected pages now perform authentication checks directly in Node.js server routes/pages.

## Changed

- Removed global `auth()` session loading from `app/layout.tsx`.
- Replaced dynamic layout-based login/logout state with stable navigation links.
- Added logout action directly to the authenticated profile page.
- Removed `middleware.ts` route protection to avoid Auth.js/Prisma execution in middleware context.
- Added explicit `runtime = "nodejs"` to Auth.js route handlers and protected pages.
- Added safe Auth.js session handling for `/profile` and `/upload`.
- Changed the home page to remain public and independent from Auth.js session loading.
- Added `/api/me/map-preference` as a fault-tolerant authenticated profile preference endpoint for the home map.
- Updated the home map client component so profile-based home-airfield preference is loaded client-side and never blocks page rendering.
- Removed the Prisma enum import from the upload server action and replaced it with a local Zod enum to reduce build-time type dependency on generated Prisma enums.

## Fixed

- Fixed post-Keycloak-login page load failures caused by global session handling in the root layout.
- Fixed build-time `Dynamic server usage` warnings for `/login` and `/_not-found` caused by `headers` usage through `auth()` during static rendering.
- Reduced risk of protected route failures caused by Prisma-backed Auth.js access in middleware.
- Preserved home-map privacy behavior: no IP fallback city/country label and no visible location information textbox.

## Operational Notes

- Deployment should continue to run `prisma generate` before `next build`.
- Public routes are no longer protected by middleware. Protection is enforced inside the server pages `/profile` and `/upload`.
- If a user is not authenticated and accesses `/profile` or `/upload`, the page redirects to `/login`.
- The home page uses the profile home-airfield preference only through the client-side API endpoint. If the endpoint fails, the map falls back to browser location, then IP-based approximate location, then the default Germany view.

## Validation

- TypeScript source changes were reviewed.
- Full local `prisma generate` could not be executed in the sandbox because Prisma engine downloads require external DNS access to `binaries.prisma.sh`.
- The previous deployment environment already reached `next build`, so this release targets the runtime/static-rendering issues visible in the provided deployment output.
