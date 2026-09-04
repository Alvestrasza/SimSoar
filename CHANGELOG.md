# Changelog

All notable changes to SimSoar are documented in this file.

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
