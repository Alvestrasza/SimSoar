import test from "node:test";
import assert from "node:assert/strict";
import {evaluateBadgeCodes, pilotLevel} from "../lib/badge-policy.ts";

const now = new Date("2026-09-04T12:00:00Z");

test("awards cumulative distance and strong thermal badges", () => {
  const badges = evaluateBadgeCodes([{
    distanceKm: 520,
    createdAt: new Date("2026-09-04T10:00:00Z"),
    thermals: [{maxClimbMs: 5.2}]
  }], now);
  assert.deepEqual(badges, ["FIRST_FLIGHT", "DISTANCE_100", "DISTANCE_300", "DISTANCE_500", "BEST_THERMAL"]);
});

test("awards weekly activity only for three distinct recent days", () => {
  const flights = [1, 2, 3].map((daysAgo) => ({
    distanceKm: 20,
    createdAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
    thermals: []
  }));
  assert.ok(evaluateBadgeCodes(flights, now).includes("WEEKLY_ACTIVITY"));
  assert.ok(!evaluateBadgeCodes([flights[0], {...flights[0]}], now).includes("WEEKLY_ACTIVITY"));
});

test("derives stable pilot levels from the active badge count", () => {
  assert.equal(pilotLevel(0), "ROOKIE");
  assert.equal(pilotLevel(1), "EXPLORER");
  assert.equal(pilotLevel(3), "ACHIEVER");
  assert.equal(pilotLevel(6), "LEGEND");
});
