import test from "node:test";
import assert from "node:assert/strict";
import {activeThermalAtSequence, buildReplayTimeline, replayIndexAtElapsed} from "../lib/flight-replay.ts";

test("builds a replay timeline from recorded timestamps", () => {
  const timeline = buildReplayTimeline([
    {seq: 1, time: "2026-09-04T10:00:00Z"},
    {seq: 2, time: "2026-09-04T10:00:02Z"},
    {seq: 3, time: "2026-09-04T10:00:05Z"}
  ]);
  assert.deepEqual(timeline, {offsets: [0, 2, 5], durationSeconds: 5, usesRecordedTime: true});
  assert.equal(replayIndexAtElapsed(timeline.offsets, 4.9), 1);
  assert.equal(replayIndexAtElapsed(timeline.offsets, 5), 2);
});

test("falls back safely when track timestamps are incomplete", () => {
  const timeline = buildReplayTimeline([{seq: 1}, {seq: 2}, {seq: 3}]);
  assert.deepEqual(timeline, {offsets: [0, 1, 2], durationSeconds: 2, usesRecordedTime: false});
});

test("finds the thermal active at a replay sequence", () => {
  const thermals = [{id: "a", startSeq: 10, endSeq: 20}, {id: "b", startSeq: 30, endSeq: 40}];
  assert.equal(activeThermalAtSequence(thermals, 15)?.id, "a");
  assert.equal(activeThermalAtSequence(thermals, 25), null);
});
