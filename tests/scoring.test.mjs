import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {parseIgc} from "../lib/igc.ts";
import {calculateScore, SIMSOAR_XC_V1} from "../lib/scoring.ts";

test("scores a closed-course IGC fixture reproducibly", () => {
  const igc = fs.readFileSync(new URL("./fixtures/scoring-closed-course.igc", import.meta.url), "utf8");
  const parsed = parseIgc(igc);

  assert.equal(parsed.scoring.ruleId, "SIMSOAR_XC_V1");
  assert.equal(parsed.scoring.isClosedCourse, true);
  assert.equal(parsed.scoring.multiplier, 1.2);
  assert.equal(parsed.scoring.points.length, 5);
  assert.equal(parsed.olcPoints, 44.53);
});

test("stores an explainable ordered route with bounded legs", () => {
  const track = Array.from({length: 20}, (_, seq) => ({
    seq,
    lat: 48 + Math.sin(seq / 2) * 0.1,
    lon: 11 + seq * 0.02
  }));
  const result = calculateScore(track);

  assert.equal(result.points[0].seq, 0);
  assert.equal(result.points.at(-1).seq, 19);
  assert.ok(result.points.length <= SIMSOAR_XC_V1.maxLegs + 1);
  assert.ok(result.points.every((point, index) => index === 0 || point.legDistanceKm > 0));
  assert.equal(result.score, Number((result.distanceKm * result.multiplier).toFixed(2)));
});

test("supports later scoring rules without changing the route engine", () => {
  const result = calculateScore([
    {seq: 0, lat: 48, lon: 11},
    {seq: 1, lat: 48, lon: 11.1}
  ], {...SIMSOAR_XC_V1, id: "TEST_RULE", maxLegs: 1, pointsPerKm: 2});

  assert.equal(result.ruleId, "TEST_RULE");
  assert.equal(result.multiplier, 2);
});
