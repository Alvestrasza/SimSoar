import test from "node:test";
import assert from "node:assert/strict";
import {leagueLeaderboard, leagueScore, recurringLeagueWindow} from "../lib/league-policy.ts";

test("calculates a configurable weekend window in UTC", () => {
  const inside = recurringLeagueWindow(new Date("2026-09-05T12:00:00Z"), {startDayUtc: 5, startHourUtc: 18, durationHours: 48});
  assert.equal(inside.startsAt.toISOString(), "2026-09-04T18:00:00.000Z");
  assert.equal(inside.endsAt.toISOString(), "2026-09-06T18:00:00.000Z");
  assert.equal(inside.contains, true);
  const outside = recurringLeagueWindow(new Date("2026-09-08T12:00:00Z"), {startDayUtc: 5, startHourUtc: 18, durationHours: 48});
  assert.equal(outside.contains, false);
});

test("scores and aggregates recurring league entries", () => {
  assert.equal(leagueScore("DISTANCE", {distanceKm: 123, olcPoints: 200}), 123);
  const ranking = leagueLeaderboard([{userId: "a", callsign: "Alpha", score: 100}, {userId: "a", callsign: "Alpha", score: 60}, {userId: "b", callsign: "Bravo", score: 150}]);
  assert.deepEqual(ranking.map((row) => [row.callsign, row.score, row.flights]), [["Alpha", 160, 2], ["Bravo", 150, 1]]);
});
