import test from "node:test";
import assert from "node:assert/strict";
import {competitionFlightScore, competitionLeaderboard, matchesCompetition} from "../lib/competition-policy.ts";

const competition = {
  startAt: new Date("2026-09-01T00:00:00Z"), endAt: new Date("2026-09-30T23:59:59Z"),
  status: "ACTIVE", simulator: "Condor 2", competitionClass: "Club", scoringRule: "OLC_POINTS"
};
const flight = {
  startTime: new Date("2026-09-10T12:00:00Z"), createdAt: new Date("2026-09-10T13:00:00Z"),
  simulator: "condor 2", competitionClass: "club", distanceKm: 210, olcPoints: 315
};

test("matches active competition windows and optional restrictions", () => {
  assert.equal(matchesCompetition(competition, flight), true);
  assert.equal(matchesCompetition({...competition, simulator: "MSFS"}, flight), false);
  assert.equal(matchesCompetition({...competition, status: "CLOSED"}, flight), false);
});

test("calculates configured flight scores", () => {
  assert.equal(competitionFlightScore(competition, flight), 315);
  assert.equal(competitionFlightScore({...competition, scoringRule: "DISTANCE"}, flight), 210);
});

test("aggregates a stable competition leaderboard", () => {
  const ranking = competitionLeaderboard([
    {userId: "a", callsign: "Alpha", score: 120}, {userId: "a", callsign: "Alpha", score: 80},
    {userId: "b", callsign: "Bravo", score: 190}
  ]);
  assert.deepEqual(ranking.map((pilot) => [pilot.callsign, pilot.score, pilot.flights]), [["Alpha", 200, 2], ["Bravo", 190, 1]]);
});
