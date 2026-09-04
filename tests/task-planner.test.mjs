import test from "node:test";
import assert from "node:assert/strict";
import {compareTaskWithFlight, normalizeTaskPoints, taskDistanceKm} from "../lib/task-planner.ts";

test("calculates the distance across ordered task legs", () => {
  const distance = taskDistanceKm([{lat: 50, lon: 8}, {lat: 50, lon: 9}, {lat: 51, lon: 9}]);
  assert.ok(distance > 180 && distance < 190);
});

test("normalizes names, codes and radii", () => {
  const points = normalizeTaskPoints([
    {name: " Start ", code: "edxx", lat: 50, lon: 8},
    {lat: 51, lon: 9, radiusM: 750}
  ]);
  assert.deepEqual(points.map(({seq, name, code, radiusM}) => ({seq, name, code, radiusM})), [
    {seq: 0, name: "Start", code: "EDXX", radiusM: 500},
    {seq: 1, name: null, code: null, radiusM: 750}
  ]);
});

test("requires ordered waypoint hits for completed flights", () => {
  const task = [{lat: 50, lon: 8, radiusM: 1000}, {lat: 50.1, lon: 8.1, radiusM: 1000}];
  const forward = [{seq: 0, lat: 50, lon: 8}, {seq: 1, lat: 50.1, lon: 8.1}];
  const reverse = [...forward].reverse();
  assert.equal(compareTaskWithFlight(task, forward).completed, true);
  assert.equal(compareTaskWithFlight(task, reverse).completed, false);
});
