import test from "node:test";
import assert from "node:assert/strict";
import {CupParseError, exportTaskToCup, formatCupCoordinate, parseCsvLine, parseCup, parseCupCoordinate} from "../lib/cup.ts";

test("parses quoted CUP CSV fields and coordinates", () => {
  assert.deepEqual(parseCsvLine('"Point, North","PN",DE'), ["Point, North", "PN", "DE"]);
  assert.equal(parseCupCoordinate("5107.830N", "lat"), 51.1305);
  assert.ok(Math.abs(parseCupCoordinate("01410.467E", "lon") - 14.17445) < 0.00001);
});

test("imports header-driven waypoints and a related task", () => {
  const data = parseCup(`code,name,lon,lat,elev,style,desc\nA,"Alpha",00800.000E,5000.000N,100m,4,"Start"\nB,"Bravo",00900.000E,5100.000N,328ft,1,"Turn"\n-----Related Tasks-----\n"Demo","Alpha","Bravo"\nObsZone=0,Style=2,R1=750m,A1=180`);
  assert.equal(data.waypoints.length, 2);
  assert.equal(data.waypoints[1].elevationM, 99.9744);
  assert.equal(data.tasks[0].points[0].radiusM, 750);
});

test("reports unknown task references with a line", () => {
  assert.throws(() => parseCup(`name,lat,lon\nAlpha,5000.000N,00800.000E\n-----Related Tasks-----\nDemo,Alpha,Missing`), (error) => error instanceof CupParseError && error.code === "unknown-task-waypoint" && error.line === 4);
});

test("exports a task as an importable CUP file", () => {
  assert.equal(formatCupCoordinate(-51.1305, "lat"), "5107.830S");
  const cup = exportTaskToCup({name: "Triangle, short", waypoints: [
    {name: "Start", code: "ST", lat: 50, lon: 8, radiusM: 750},
    {name: "Start", code: "FN", lat: 51, lon: 9, radiusM: 500}
  ]});
  const parsed = parseCup(cup);
  assert.equal(parsed.tasks[0].name, "Triangle, short");
  assert.deepEqual(parsed.tasks[0].points.map((point) => point.radiusM), [750, 500]);
  assert.deepEqual(parsed.waypoints.map((point) => point.name), ["Start", "Start (2)"]);
});
