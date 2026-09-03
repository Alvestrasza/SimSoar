import assert from "node:assert/strict";
import test from "node:test";
import {sortThermals} from "../lib/thermal-analysis.ts";

const thermals = [
  {seq: 1, avgClimbMs: 1.5, gainM: 300},
  {seq: 2, avgClimbMs: 2.1, gainM: 180},
  {seq: 3, avgClimbMs: 1.2, gainM: 450}
];

test("sorts thermals by strength without mutating the source", () => {
  assert.deepEqual(sortThermals(thermals, "strength").map((thermal) => thermal.seq), [2, 1, 3]);
  assert.deepEqual(thermals.map((thermal) => thermal.seq), [1, 2, 3]);
});

test("sorts thermals by altitude gain", () => {
  assert.deepEqual(sortThermals(thermals, "gain").map((thermal) => thermal.seq), [3, 1, 2]);
});
