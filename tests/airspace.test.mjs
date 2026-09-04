import test from "node:test";
import assert from "node:assert/strict";
import {
  airspaceBounds,
  findAirspaceCrossings,
  parseOpenAir,
  parseOpenAirCoordinate,
  pointInPolygon,
  validateAirspaceImport
} from "../lib/airspace.ts";

const polygon = [
  {lat: 50, lon: 8},
  {lat: 50, lon: 9},
  {lat: 51, lon: 9},
  {lat: 51, lon: 8}
];

test("parses decimal and standard OpenAir coordinates", () => {
  assert.deepEqual(parseOpenAirCoordinate("50.5, 8.25"), {lat: 50.5, lon: 8.25});
  assert.deepEqual(parseOpenAirCoordinate("50:30:00 N 008:15:00 E"), {lat: 50.5, lon: 8.25});
});

test("imports supported OpenAir polygon records", () => {
  const airspaces = parseOpenAir(`
AC C
AN Example CTR
AL GND
AH 2500 FT
DP 50.0, 8.0
DP 50.0, 9.0
DP 51.0, 9.0
DP 51.0, 8.0
`);
  assert.equal(airspaces.length, 1);
  assert.equal(airspaces[0].name, "Example CTR");
  assert.equal(airspaces[0].points.length, 4);
});

test("detects points and track segments crossing a polygon", () => {
  assert.equal(pointInPolygon({lat: 50.5, lon: 8.5}, polygon), true);
  const crossings = findAirspaceCrossings([
    {seq: 10, lat: 50.5, lon: 7.5},
    {seq: 20, lat: 50.5, lon: 9.5}
  ], [{id: "a1", name: "Example", className: "C", floorLabel: "GND", ceilingLabel: "2500 FT", points: polygon}]);
  assert.equal(crossings.length, 1);
  assert.equal(crossings[0].firstTrackSeq, 10);
  assert.equal(crossings[0].lastTrackSeq, 20);
});

test("converts OpenAir circles and clockwise arcs into bounded polygons", () => {
  const airspaces = parseOpenAir(`
AC R
AN Example circle
AL GND
AH 2500 FT
V X=50:30:00 N 008:15:00 E
DC 1.00
AC C
AN Example arc
AL 1000 FT
AH FL 75
DP 50:30:00 N 008:15:00 E
V X=50:30:00 N 008:15:00 E
V D=+
DB 50:31:00 N 008:15:00 E, 50:30:00 N 008:16:33 E
DP 50:30:00 N 008:15:00 E
`);
  assert.equal(airspaces.length, 2);
  assert.ok(airspaces[0].points.length >= 70);
  assert.ok(airspaces[1].points.length >= 4);
  assert.ok(airspaces[0].points.every((point) => Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180));
});

test("validates large regional imports by total and per-airspace limits", () => {
  const airspaces = Array.from({length: 700}, (_, index) => ({
    name: `Region ${index}`,
    className: "C",
    floorLabel: "GND",
    ceilingLabel: "FL 100",
    points: polygon
  }));
  assert.deepEqual(validateAirspaceImport(airspaces, {
    maxAirspaces: 50_000,
    maxPointsPerAirspace: 50_000,
    maxTotalPoints: 2_000_000
  }), {ok: true, reason: null, totalPoints: 2800});
  assert.equal(validateAirspaceImport(airspaces, {
    maxAirspaces: 600,
    maxPointsPerAirspace: 50_000,
    maxTotalPoints: 2_000_000
  }).reason, "airspaces");
});

test("calculates airspace bounds for spatial prefiltering", () => {
  assert.deepEqual(airspaceBounds(polygon), {minLat: 50, maxLat: 51, minLon: 8, maxLon: 9});
});
