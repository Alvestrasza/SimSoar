# Badges, achievements, and levels

SimSoar automatically awards enabled badges from approved, non-deleted flight data. Badge assignments are visible on the pilot's own profile and on public pilot profiles.

## Included badges

- First Flight: at least one approved flight.
- 100 km, 300 km, and 500 km: at least one approved flight reaching the respective distance.
- Strong Thermal: at least one detected thermal with a maximum climb rate of 5 m/s or more.
- Weekly Activity: approved uploads on at least three distinct days during the last seven days.

The visible pilot level is derived from the number of currently active badges: Rookie, Explorer, Achiever, or Legend.

## Recalculation

Assignments are calculated after uploads and relevant flight edits. Moderation, soft deletion, restoration, and permanent deletion also recalculate the affected pilot. The database migration backfills assignments for existing flights.

Administrators can enable or disable individual badge definitions from the badge management page. Disabling a badge removes its assignments; enabling it recalculates all pilots.
