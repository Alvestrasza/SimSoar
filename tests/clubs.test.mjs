import test from "node:test";
import assert from "node:assert/strict";
import {clubRanking, normalizeClubSlug} from "../lib/club-policy.ts";

test("normalizes stable public club slugs", () => {
  assert.equal(normalizeClubSlug("  LSV Überflieger Süd!  "), "lsv-uberflieger-sud");
  assert.equal(normalizeClubSlug("---"), "");
});

test("ranks club pilots by OLC points and distance", () => {
  const ranking = clubRanking([
    {callsign: "Bravo", flights: [{distanceKm: 200, olcPoints: 300}]},
    {callsign: "Alpha", flights: [{distanceKm: 150, olcPoints: 300}]},
    {callsign: "Charlie", flights: []}
  ]);
  assert.deepEqual(ranking.map((entry) => entry.callsign), ["Bravo", "Alpha", "Charlie"]);
  assert.equal(ranking[0].totalDistanceKm, 200);
  assert.equal(ranking[2].flightsCount, 0);
});
