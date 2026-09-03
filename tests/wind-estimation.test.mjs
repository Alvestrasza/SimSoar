import test from "node:test";
import assert from "node:assert/strict";
import {estimateThermalWind, summarizeWindEstimates} from "../lib/wind-estimation.ts";

function driftingThermal(count, latitudeStep) {
  return Array.from({length: count}, (_, index) => ({
    secondsOfDay: index * 10,
    lat: 50 + latitudeStep * index,
    lon: 8
  }));
}

test("estimates meteorological wind direction and confidence from thermal drift", () => {
  const estimate = estimateThermalWind(driftingThermal(24, 0.00005));

  assert.ok(estimate);
  assert.ok(estimate.directionDeg >= 175 && estimate.directionDeg <= 185);
  assert.ok(estimate.speedKmh > 1);
  assert.equal(estimate.confidence, "HIGH");
});

test("marks short or weak thermal drift as low confidence", () => {
  const estimate = estimateThermalWind(driftingThermal(8, 0.00001));

  assert.ok(estimate);
  assert.equal(estimate.confidence, "LOW");
});

test("builds a flight estimate only from medium or high confidence thermals", () => {
  assert.equal(summarizeWindEstimates([{directionDeg: 180, speedKmh: 12, confidence: "LOW"}]), null);

  const estimate = summarizeWindEstimates([
    {directionDeg: 180, speedKmh: 10, confidence: "HIGH"},
    {directionDeg: 180, speedKmh: 14, confidence: "MEDIUM"}
  ]);
  assert.deepEqual(estimate, {
    directionDeg: 180,
    speedKmh: 12,
    confidence: "HIGH",
    driftDistanceM: 0
  });
});
