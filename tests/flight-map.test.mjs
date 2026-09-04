import assert from "node:assert/strict";
import test from "node:test";

import {
  flightTrackEndpoints,
  simplifyFlightTrack
} from "../lib/flight-map.ts";

test("keeps short flight tracks unchanged", () => {
  const points = [
    {lat: 50, lon: 8},
    {lat: 50.1, lon: 8.1}
  ];

  assert.deepEqual(simplifyFlightTrack(points), points);
});

test("simplifies long tracks while preserving both endpoints", () => {
  const points = Array.from({length: 1000}, (_, index) => ({
    lat: 50 + index / 1000,
    lon: 8 + index / 1000
  }));
  const simplified = simplifyFlightTrack(points, 100);

  assert.equal(simplified.length, 100);
  assert.deepEqual(simplified[0], points[0]);
  assert.deepEqual(simplified.at(-1), points.at(-1));
});

test("returns start and landing points", () => {
  const points = [
    {lat: 50, lon: 8},
    {lat: 51, lon: 9},
    {lat: 52, lon: 10}
  ];

  assert.deepEqual(flightTrackEndpoints(points), {
    start: points[0],
    finish: points[2]
  });
  assert.equal(flightTrackEndpoints([]), null);
});
