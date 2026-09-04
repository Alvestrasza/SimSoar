# Flight segments

SimSoar can measure flights across administrator-defined start and finish gates and publish a fastest-time ranking.

## Eligibility and privacy

- Only active segments are evaluated.
- Only approved, public, non-deleted flights contribute results.
- A result is removed when a flight no longer meets these conditions.
- The public ranking lists the fastest qualifying flights.

## Detection

Each gate is represented by a coordinate and radius. A flight completes a segment when a timestamped track point enters the start gate and a later timestamped track point enters the finish gate. The elapsed time is stored together with the corresponding track point sequence numbers. If a flight completes the same segment more than once, its fastest complete passage is used.

Segment results are recalculated after upload, IGC replacement, relevant flight moderation or visibility changes, and after an administrator changes the segment definition.

## Administration

Administrators can create, edit, activate, deactivate, and delete segments from the admin dashboard. Deactivation removes calculated results until the segment is activated and recalculated again. Administrative changes are audit logged.
