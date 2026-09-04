# Competitions and seasons

Competitions define a name, public slug, description, rules, active time window, scoring rule, and optional simulator and competition-class restrictions.

## Automatic assignment

An approved, public, non-deleted flight is assigned when its recorded start time (or upload time when unavailable) lies inside an active competition window and its optional simulator and class restrictions match case-insensitively. Assignments and scores are recalculated after upload, flight editing, moderation, deletion, and restoration. Saving an active competition recalculates all matching existing flights.

Scores use either the stored OLC points or flight distance. Public leaderboards aggregate all assigned flight scores per pilot.

## Lifecycle

Administrators can create competitions as drafts or activate them immediately, edit their settings, close them early, and delete them. Active competitions whose end date has passed are automatically closed and retained in the public archive. Closing preserves the final assigned flights and leaderboard.

Draft competitions are not public. Active and closed competition pages expose only the explicitly configured competition metadata and assigned flight summaries.
