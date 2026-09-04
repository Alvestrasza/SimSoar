# Clubs and teams

SimSoar clubs provide a shared identity and a foundation for club competitions, events, and team rankings.

## Data model

A club has a stable public slug, name, optional description, timestamps, and memberships. Memberships form a many-to-many relation between users and clubs and carry either a `MEMBER` or `MANAGER` role. The role is intentionally stored now so future self-service club administration can be added without changing the membership model.

## Public pages

The club overview lists membership and public-flight totals. Each club profile shows its members, a ranking by accumulated OLC points with distance as the tie-breaker, and the twenty newest public, approved, non-deleted flights from its members. Private, moderated, and deleted flights never contribute to public club pages or rankings.

## Administration

Administrators can create, edit, and delete clubs and can assign, update, or remove memberships. These changes are audit logged. Deleting a club removes its memberships through a cascading database relation but does not remove users or flights.
