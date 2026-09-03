import assert from "node:assert/strict";
import test from "node:test";
import {detectScoringWindow} from "../lib/scoring-window.ts";

function point(seq, secondsOfDay, lat, altM) {
  return {seq, secondsOfDay, lat, lon: 11, altM};
}

test("trims stationary launch data and a detected tow or engine climb", () => {
  const window = detectScoringWindow([
    point(0, 36000, 48, 100),
    point(1, 36060, 48, 100),
    point(2, 36120, 48.01, 250),
    point(3, 36180, 48.02, 420),
    point(4, 36240, 48.03, 420),
    point(5, 36300, 48.04, 380)
  ]);

  assert.equal(window.startSeq, 3);
  assert.equal(window.endSeq, 5);
  assert.deepEqual(window.reasons, ["stationary-trim", "launch-climb"]);
});

test("selects the strongest continuous section across a recording pause", () => {
  const window = detectScoringWindow([
    point(0, 36000, 48, 500),
    point(1, 36060, 48.001, 500),
    point(2, 37000, 48.1, 500),
    point(3, 37060, 48.15, 500),
    point(4, 37120, 48.2, 500)
  ]);

  assert.equal(window.startSeq, 2);
  assert.equal(window.endSeq, 4);
  assert.ok(window.reasons.includes("track-gap"));
});

test("falls back safely when every valid point is separated by a large gap", () => {
  const window = detectScoringWindow([
    point(0, 36000, 48, 500),
    point(1, 37000, 48.1, 500),
    point(2, 38000, 48.2, 500)
  ]);

  assert.equal(window.startSeq, 0);
  assert.equal(window.endSeq, 2);
  assert.ok(window.reasons.includes("fallback-full-segment"));
});
