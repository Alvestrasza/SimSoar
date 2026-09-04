import test from "node:test";
import assert from "node:assert/strict";
import {buildGroupReplayTimeline, groupReplayIndexAtElapsed} from "../lib/group-replay.ts";

test("aligns flights on one absolute recorded timeline", () => {
  const timeline = buildGroupReplayTimeline([
    {id: "a", track: [{seq: 0, time: "2026-09-04T10:00:00Z"}, {seq: 1, time: "2026-09-04T10:10:00Z"}]},
    {id: "b", track: [{seq: 0, time: "2026-09-04T10:05:00Z"}, {seq: 1, time: "2026-09-04T10:15:00Z"}]}
  ]);
  assert.equal(timeline.usesRecordedTime, true);
  assert.deepEqual(timeline.offsetsByFlightId, {a: [0, 600], b: [300, 900]});
  assert.equal(groupReplayIndexAtElapsed(timeline.offsetsByFlightId.b, 299), -1);
  assert.equal(groupReplayIndexAtElapsed(timeline.offsetsByFlightId.b, 300), 0);
});

test("falls back to relative per-flight progress for incomplete timestamps", () => {
  const timeline = buildGroupReplayTimeline([{id: "a", track: [{seq: 0}, {seq: 1}, {seq: 2}]}]);
  assert.equal(timeline.usesRecordedTime, false);
  assert.deepEqual(timeline.offsetsByFlightId.a, [0, 1, 2]);
});

test("returns an empty shared timeline safely", () => {
  assert.deepEqual(buildGroupReplayTimeline([]), {offsetsByFlightId: {}, durationSeconds: 0, usesRecordedTime: false});
});
