import test from "node:test";
import assert from "node:assert/strict";
import {detectSegmentCompletion, segmentLeaderboard} from "../lib/segment-policy.ts";

const segment = {startLat: 50, startLon: 8, finishLat: 50.1, finishLon: 8.1, gateRadiusM: 1000};

test("detects ordered segment gates and elapsed time", () => {
  const result = detectSegmentCompletion(segment, [
    {seq: 0, lat: 49.9, lon: 7.9, time: "2026-09-04T10:00:00Z"},
    {seq: 1, lat: 50, lon: 8, time: "2026-09-04T10:01:00Z"},
    {seq: 2, lat: 50.1, lon: 8.1, time: "2026-09-04T10:06:30Z"}
  ]);
  assert.deepEqual({startSeq: result?.startSeq, finishSeq: result?.finishSeq, durationSeconds: result?.durationSeconds}, {startSeq: 1, finishSeq: 2, durationSeconds: 330});
});

test("rejects reverse or timeless crossings", () => {
  assert.equal(detectSegmentCompletion(segment, [{seq: 0, lat: 50.1, lon: 8.1, time: new Date()}, {seq: 1, lat: 50, lon: 8, time: new Date()}]), null);
  assert.equal(detectSegmentCompletion(segment, [{seq: 0, lat: 50, lon: 8}, {seq: 1, lat: 50.1, lon: 8.1}]), null);
});

test("ranks individual flights by elapsed time", () => {
  const ranked = segmentLeaderboard([
    {userId: "a", durationSeconds: 400, completedAt: new Date("2026-01-02")},
    {userId: "a", durationSeconds: 300, completedAt: new Date("2026-01-03")},
    {userId: "b", durationSeconds: 350, completedAt: new Date("2026-01-01")}
  ]);
  assert.deepEqual(ranked.map((entry) => [entry.userId, entry.durationSeconds]), [["a", 300], ["b", 350], ["a", 400]]);
});

test("uses the fastest complete passage when a flight repeats a segment", () => {
  const result = detectSegmentCompletion(segment, [
    {seq: 0, lat: 50, lon: 8, time: "2026-09-04T10:00:00Z"},
    {seq: 1, lat: 50.05, lon: 8.05, time: "2026-09-04T10:02:00Z"},
    {seq: 2, lat: 50.1, lon: 8.1, time: "2026-09-04T10:05:00Z"},
    {seq: 3, lat: 50.05, lon: 8.05, time: "2026-09-04T10:06:00Z"},
    {seq: 4, lat: 50, lon: 8, time: "2026-09-04T10:07:00Z"},
    {seq: 5, lat: 50.05, lon: 8.05, time: "2026-09-04T10:08:00Z"},
    {seq: 6, lat: 50.1, lon: 8.1, time: "2026-09-04T10:10:00Z"}
  ]);
  assert.deepEqual({startSeq: result?.startSeq, finishSeq: result?.finishSeq, durationSeconds: result?.durationSeconds}, {startSeq: 4, finishSeq: 6, durationSeconds: 180});
});
