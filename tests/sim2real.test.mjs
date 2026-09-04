import test from "node:test";
import assert from "node:assert/strict";
import {buildPlanningDraftBundle, buildSim2RealReview, parseAirspaceAltitude, parseSim2RealAssumptions, verticalConflict} from "../lib/sim2real.ts";

const task = {id: "task-1", lineageId: "lineage-1", revision: 3, name: "Alpine task", updatedAt: new Date("2026-09-01T00:00:00Z"), waypoints: [{lat: 48, lon: 11, name: "A"}, {lat: 48, lon: 12, name: "B"}]};
const airspace = {id: "asp-1", name: "Restricted", className: "R", floorLabel: "1000 FT", ceilingLabel: "FL 65", sourceName: "Official regional export", createdAt: new Date("2026-09-03T00:00:00Z"), points: [{lat: 47.8, lon: 11.4}, {lat: 48.2, lon: 11.4}, {lat: 48.2, lon: 11.6}, {lat: 47.8, lon: 11.6}]};

test("parses common vertical airspace labels without claiming pressure accuracy", () => {
  assert.equal(parseAirspaceAltitude("GND"), 0);
  assert.equal(Math.round(parseAirspaceAltitude("FL 65")), 1981);
  assert.equal(verticalConflict(1500, "1000 FT", "FL 65"), true);
  assert.equal(verticalConflict(null, "1000 FT", "FL 65"), null);
});

test("reports horizontal and vertical conflicts when sufficient data exists", () => {
  const review = buildSim2RealReview({task, airspaces: [airspace], assumptions: parseSim2RealAssumptions({aircraft: "Test sailplane", glideRatio: "40", cruiseSpeedKmh: "100", plannedAltitudeM: "1500"}), now: new Date("2026-09-04T00:00:00Z")});
  assert.equal(review.crossings.length, 1);
  assert.equal(review.crossings[0].verticalConflict, true);
  assert.equal(review.datasets.find((item) => item.kind === "AIRSPACE")?.state, "CONFLICT");
  assert.equal(review.summary.estimatedDurationMinutes, 45);
});

test("missing and stale datasets never appear as passed checks", () => {
  const review = buildSim2RealReview({task, airspaces: [{...airspace, createdAt: new Date("2025-01-01T00:00:00Z")}], assumptions: parseSim2RealAssumptions({}), now: new Date("2026-09-04T00:00:00Z")});
  assert.equal(review.datasets.find((item) => item.kind === "AIRSPACE")?.state, "WARNING");
  for (const kind of ["TERRAIN", "AERODROME", "WEATHER", "NOTAM"]) assert.notEqual(review.datasets.find((item) => item.kind === kind)?.state, "PASS");
});

test("planning bundle labels the export and includes revisioned provenance", () => {
  const review = buildSim2RealReview({task, airspaces: [], assumptions: parseSim2RealAssumptions({}), now: new Date("2026-09-04T00:00:00Z")});
  const bundle = buildPlanningDraftBundle(task, review);
  assert.equal(bundle.review.task.revision, 3);
  assert.match(bundle.warning, /DRAFT ONLY/);
  assert.match(Buffer.from(bundle.files[0].data, "base64").toString("utf8"), /\[PLANNING DRAFT\]/);
});
