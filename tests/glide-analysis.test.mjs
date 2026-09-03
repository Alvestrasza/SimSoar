import test from "node:test";
import assert from "node:assert/strict";
import {detectGlidePhases} from "../lib/igc.ts";

function createCruiseTrack(count, options = {}) {
  const points = [];
  for (let seq = 0; seq < count; seq += 1) {
    const secondsOfDay = seq >= (options.gapAfter ?? Infinity) ? seq + 120 : seq;
    points.push({
      seq,
      secondsOfDay,
      lat: 50 + seq * 0.0001,
      lon: 8,
      altM: 1200 - seq,
      varioMs: -1
    });
  }
  return points;
}

test("detects glide phases around a thermal and calculates performance metrics", () => {
  const phases = detectGlidePhases(createCruiseTrack(101), [{
    seq: 1,
    startSeq: 40,
    endSeq: 60,
    avgClimbMs: 1,
    maxClimbMs: 2,
    gainM: 20,
    durationSec: 20,
    efficiencyPercent: 50
  }]);

  assert.equal(phases.length, 2);
  assert.deepEqual(phases.map((phase) => [phase.startSeq, phase.endSeq]), [[0, 39], [61, 100]]);
  assert.equal(phases[0].durationSec, 39);
  assert.ok(phases[0].distanceKm > 0.4);
  assert.equal(phases[0].avgSinkMs, -1);
  assert.ok(phases[0].glideRatio > 10);
});

test("splits glide phases at recording gaps", () => {
  const phases = detectGlidePhases(createCruiseTrack(100, {gapAfter: 50}), []);

  assert.equal(phases.length, 2);
  assert.deepEqual(phases.map((phase) => [phase.startSeq, phase.endSeq]), [[0, 49], [50, 99]]);
});
