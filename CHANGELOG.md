# Changelog

All notable changes to SimSoar are documented in this file.

## [0.6.3] - 2026-09-05

- Aligned the configurable flight-data rail directly to the left or right viewport edge, with square tiles, larger symbols and smaller labels (#75).
- Kept the footer visible alongside the top navigation, with measured space for wrapped text, mobile menus and page-end content (#76).
- Made shared content and top-level page wrappers grow with the viewport from 1900px onward, without large outer margins (#76).
- Preserved mobile navigation, table-local scrolling and normal document/keyboard scrolling. No authentication, preference persistence or database behavior changes.

## [0.6.2] - 2026-09-05

- Removed the legacy document minimum width that clipped the right edge at a 320px viewport with a non-overlay scrollbar (#76). Added a regression guard.
- Both DEV instances serve v0.6.2. All 158 automated tests and optimized builds pass; mobile checks confirmed that pages and menus remain inside narrow viewports. Authenticated journal and preference acceptance remains open; see [development acceptance](docs/acceptance-v0.6.2.md). Production is unchanged.

## [0.6.1] - 2026-09-05

### Navigation and personal journal

- Retained global actions in the top header and added a per-user left/right flight-data sidebar, with all destinations available in the mobile menu (#75).
- Consolidated shared widths and reduced oversized card, form, table and hero spacing while retaining local table scrolling and touch-friendly controls (#76).
- Added an owner-private Pilot Journal combining available recorded activities with dated personal notes and securely processed photographs (#77).
- Added an additive journal/navigation migration, bounded chronological pagination, owner-scoped image delivery, storage quotas and regression coverage.
- See [Navigation and layout](docs/navigation-and-layout.md) and [Pilot Journal](docs/pilot-journal.md) for usage and limitations. These changes remain in the existing v0.6.0 milestone; production promotion requires separate authorization.

## [0.6.0] - 2026-09-04

SimSoar v0.6.0 consolidates the security, trust, integration, and Sim2Real controls assigned to the v0.6.0 milestone. It is deployed to the development environment only and is not a production promotion.

### Security hardening

- Updated vulnerable framework and production dependencies and retained a zero-critical deployment gate (#71).
- Enforced exact environment-scoped identity groups and fail-closed role mapping (#72).
- Bound IGC uploads to the authenticated pilot profile instead of submitted identity metadata (#73).
- Prevented shared caching of protected flight-story images (#74).
- Added scoped, revocable OAuth with PKCE, strict redirect validation, endpoint scopes, idempotency, rate limits, and sanitized audit records (#69).

### Trusted data exchange

- Added versioned, bounded, data-only task packages with compatibility declarations and per-file SHA-256 verification (#51).
- Added revisioned Ed25519 authenticity evidence, transparent findings, moderator decisions, corrections, and appeals without automatic disqualification (#60).
- Added an explicit Sim2Real review gate with revisioned data provenance, fail-closed airspace checks, required assumptions and alternatives, and clearly labelled planning exports (#47).
- Added an optional Windows-first companion with exact user-approved roots, explicit upload consent, OAuth-only authentication, signed update verification, rollback backups, and no downloaded-script or arbitrary-command execution path (#53).

### Verification and residual risk

- The exact release commit passed 145 tests, Prisma validation and client generation, TypeScript checking, and an optimized production build.
- All intended DEV application instances reported the same commit and rendered v0.6.0; public health checks passed and protected write endpoints returned `401` without authorization.
- The dependency audit reported no critical findings. Three high findings map to one recursive-merge denial-of-service advisory in the Prisma CLI/configuration toolchain. The Prisma CLI is not a direct web-runtime dependency; remediation requires a separately validated Prisma major upgrade.
- See [Security Review — v0.6.0](docs/security-review-v0.6.0.md) for scope, evidence, limitations, and follow-up guidance.

## [0.5.0] - 2026-09-04

SimSoar v0.5.0 consolidates the functionality delivered throughout the v0.4.x development series into a defined development-environment feature baseline. It is not a production promotion.

### Flight ingestion and management

- Added single and bulk IGC upload with server-side validation, hashing, duplicate detection, and persistent storage.
- Added protected downloads, visibility controls, editing, replacement, deletion, reporting, and moderation workflows.
- Added simulator-aware metadata and legacy data import support.

### Analysis and visualization

- Added configurable scoring, scoring windows, leaderboards, and detailed flight statistics.
- Added thermal, glide, cruise, wind, altitude, route, and airspace analysis.
- Added interactive maps, replay, 3D visualization, multi-flight comparison, and group replay.
- Added bounded OpenAir ingestion and airspace crossing warnings.

### Community

- Added pilot profiles with callsigns and home airfields that support identifiers, names, and coordinates.
- Added following, the home feed, likes, comments, notifications, reports, flight stories, protected story images, and badges.
- Added clubs and teams with membership and administration workflows.

### Tasks and competitions

- Added competitions, seasons, leagues, standings, and participation workflows.
- Added a map-based task planner, CUP import/export, reusable tasks, and segments.

### Platform and administration

- Added OpenID Connect authentication, role-based administration, moderation, and audit logging.
- Added the versioned public API and operational import tooling.
- Improved responsive desktop and mobile layouts, navigation, sortable tables, compact filtering, accessibility, and bilingual presentation.
- Added public operator documentation and contributor-restricted administration documentation in the GitHub wiki.

### Release boundary

- Issues #46 through #70 belong to the v0.6.0 milestone and are intentionally excluded from v0.5.0.
- Production deployment is outside this release documentation and requires separate authorization and verification.
