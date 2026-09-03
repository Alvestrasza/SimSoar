import test from "node:test";
import assert from "node:assert/strict";
import {findAirspaceCrossings, parseOpenAir, parseOpenAirCoordinate, pointInPolygon} from "../lib/airspace.ts";

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
