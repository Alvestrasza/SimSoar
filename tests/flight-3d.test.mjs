import test from "node:test";
import assert from "node:assert/strict";
import {normalizeFlight3d} from "../lib/flight-3d.ts";

test("normalizes route coordinates and altitude into a bounded 3D scene", () => {
  const result = normalizeFlight3d([
    {lat: 50, lon: 8, altM: 200},
    {lat: 51, lon: 10, altM: 1200}
  ]);
  assert.equal(result.minAltitudeM, 200);
  assert.equal(result.maxAltitudeM, 1200);
  assert.deepEqual(result.vertices, [-0.75, -0.55, -0.75, 0.75, 0.55, 0.75]);
});

test("keeps flat tracks finite", () => {
  const result = normalizeFlight3d([{lat: 50, lon: 8, altM: 500}, {lat: 50, lon: 8, altM: 500}]);
  assert.equal(result.vertices.every(Number.isFinite), true);
});

test("ignores invalid points and handles an empty scene", () => {
  assert.deepEqual(normalizeFlight3d([{lat: Number.NaN, lon: 8, altM: 500}]), {vertices: [], minAltitudeM: 0, maxAltitudeM: 0});
});
