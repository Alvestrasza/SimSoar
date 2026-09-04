import test from "node:test";
import assert from "node:assert/strict";
import {FixedWindowRateLimiter, PUBLIC_FLIGHT_WHERE, parsePublicApiPagination, publicFlightSummary} from "../lib/public-api.ts";

test("keeps the public API flight boundary explicit", () => {
  assert.deepEqual(PUBLIC_FLIGHT_WHERE, {visibility: "PUBLIC", moderationStatus: "APPROVED", deletedAt: null});
});

test("bounds public API pagination", () => {
  assert.deepEqual(parsePublicApiPagination(new URLSearchParams("page=2&limit=500")), {page: 2, limit: 100, skip: 100});
  assert.deepEqual(parsePublicApiPagination(new URLSearchParams("page=-2&limit=0")), {page: 1, limit: 1, skip: 0});
  assert.deepEqual(parsePublicApiPagination(new URLSearchParams("page=nope&limit=nope")), {page: 1, limit: 25, skip: 0});
});

test("enforces and resets a fixed rate window per client", () => {
  const limiter = new FixedWindowRateLimiter(2, 1000);
  assert.equal(limiter.consume("a", 0).allowed, true);
  assert.equal(limiter.consume("a", 100).remaining, 0);
  assert.equal(limiter.consume("a", 200).allowed, false);
  assert.equal(limiter.consume("b", 200).allowed, true);
  assert.equal(limiter.consume("a", 1000).allowed, true);
});

test("serializes only the stable public flight summary", () => {
  const result = publicFlightSummary({
    id: "flight", title: "Public", pilotCallsign: "ALICE", simulator: "Condor", glider: null,
    competitionClass: null, startTime: new Date("2026-09-04T10:00:00Z"), durationSeconds: 60,
    distanceKm: 12.3, olcPoints: 20, avgSpeedKmh: 90, maxAltitudeM: 1200, maxVarioMs: 2.5,
    createdAt: new Date("2026-09-04T10:00:00Z"), updatedAt: new Date("2026-09-04T10:01:00Z"),
    igcSha256: "must-not-leak", igcObjectPath: "must-not-leak"
  });
  assert.equal(result.startTime, "2026-09-04T10:00:00.000Z");
  assert.equal("igcSha256" in result, false);
  assert.equal("igcObjectPath" in result, false);
});
