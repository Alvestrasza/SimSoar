import assert from "node:assert/strict";
import test from "node:test";
import {detectThermals} from "../lib/igc.ts";

function createTrack(phases) {
  const points = [];
  let secondsOfDay = 10 * 3600;
  let altitude = 1000;

  const addPoint = (varioMs) => {
    points.push({
      seq: points.length,
      time: new Date(Date.UTC(2026, 5, 1, 0, 0, secondsOfDay)),
      secondsOfDay,
      lat: 48 + points.length * 0.00001,
      lon: 11 + points.length * 0.00001,
      altM: altitude,
      varioMs
    });
  };

  addPoint(undefined);

  for (const {durationSeconds, climbMs} of phases) {
    for (let second = 0; second < durationSeconds; second += 1) {
      secondsOfDay += 1;
      altitude += climbMs;
      addPoint(climbMs);
    }
  }

  return points;
}

test("keeps a sustained thermal as one complete segment", () => {
  const thermals = detectThermals(
    createTrack([{durationSeconds: 180, climbMs: 1}])
  );

  assert.equal(thermals.length, 1);
  assert.equal(thermals[0].durationSec, 180);
  assert.equal(thermals[0].gainM, 180);
  assert.equal(thermals[0].avgClimbMs, 1);
  assert.equal(thermals[0].startSeq, 0);
  assert.equal(thermals[0].endSeq, 180);
  assert.equal(thermals[0].efficiencyPercent, 100);
});

test("keeps a thermal together across a brief interruption", () => {
  const thermals = detectThermals(
    createTrack([
      {durationSeconds: 90, climbMs: 1},
      {durationSeconds: 10, climbMs: -1},
      {durationSeconds: 90, climbMs: 1}
    ])
  );

  assert.equal(thermals.length, 1);
  assert.equal(thermals[0].durationSec, 190);
  assert.equal(thermals[0].gainM, 170);
});

test("separates thermals after a sustained interruption", () => {
  const thermals = detectThermals(
    createTrack([
      {durationSeconds: 90, climbMs: 1},
      {durationSeconds: 30, climbMs: -1},
      {durationSeconds: 90, climbMs: 1}
    ])
  );

  assert.equal(thermals.length, 2);
  assert.deepEqual(
    thermals.map((thermal) => thermal.durationSec),
    [90, 90]
  );
});

test("does not stop after eight detected thermals", () => {
  const phases = [];

  for (let thermal = 0; thermal < 10; thermal += 1) {
    phases.push({durationSeconds: 70, climbMs: 1});
    phases.push({durationSeconds: 25, climbMs: -1});
  }

  const thermals = detectThermals(createTrack(phases));

  assert.equal(thermals.length, 10);
  assert.equal(thermals.at(-1).seq, 10);
});

test("ignores climb segments that are too short", () => {
  const thermals = detectThermals(
    createTrack([{durationSeconds: 40, climbMs: 1}])
  );

  assert.deepEqual(thermals, []);
});
