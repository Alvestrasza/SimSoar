import test from "node:test";
import assert from "node:assert/strict";
import {canCompareFlights, formatComparisonDuration, normalizeComparisonIds} from "../lib/flight-comparison.ts";

test("normalizes unique comparison selections and caps them at five", () => {
  assert.deepEqual(normalizeComparisonIds([" a ", "b", "a", "c", "d", "e", "f"]), ["a", "b", "c", "d", "e"]);
});

test("requires between two and five flights", () => {
  assert.equal(canCompareFlights(["a"]), false);
  assert.equal(canCompareFlights(["a", "b"]), true);
  assert.equal(canCompareFlights(["a", "b", "c", "d", "e"]), true);
  assert.equal(canCompareFlights(["a", "b", "c", "d", "e", "f"]), false);
});

test("formats comparison duration consistently", () => {
  assert.equal(formatComparisonDuration(5430), "1:30");
});
