import assert from "node:assert/strict";
import test from "node:test";

import {
  homeAirfieldSearchQuery,
  isIcaoCode,
  normalizeHomeAirfield,
  parseHomeAirfieldCoordinates,
  resolveHomeAirfieldLocation
} from "../lib/airfield.ts";

test("recognizes four-letter ICAO codes", () => {
  assert.equal(isIcaoCode("EDDF"), true);
  assert.equal(isIcaoCode(" eddm "), true);
  assert.equal(isIcaoCode("EDDF1"), false);
  assert.equal(isIcaoCode("Frankfurt"), false);
});

test("normalizes ICAO codes to uppercase", () => {
  assert.equal(normalizeHomeAirfield(" eddf "), "EDDF");
  assert.equal(normalizeHomeAirfield("KJFK"), "KJFK");
});

test("keeps existing airfield names compatible", () => {
  assert.equal(
    normalizeHomeAirfield("  Frankfurt Airport  "),
    "Frankfurt Airport"
  );
});

test("clears blank home airfields", () => {
  assert.equal(normalizeHomeAirfield("   "), null);
  assert.equal(normalizeHomeAirfield(null), null);
});

test("uses airport-aware search queries for ICAO codes", () => {
  assert.equal(homeAirfieldSearchQuery("eddf"), "EDDF airport");
  assert.equal(
    homeAirfieldSearchQuery("Frankfurt Airport"),
    "Frankfurt Airport"
  );
});

test("accepts coordinates for airfields without an ICAO code", () => {
  assert.deepEqual(
    parseHomeAirfieldCoordinates("50.4970, 9.9520"),
    {lat: 50.497, lon: 9.952}
  );
  assert.equal(
    normalizeHomeAirfield(" 50.4970; 9.9520 "),
    "50.497, 9.952"
  );
  assert.deepEqual(
    resolveHomeAirfieldLocation("50.4970, 9.9520"),
    {
      kind: "coordinates",
      lat: 50.497,
      lon: 9.952,
      label: "50.497, 9.952"
    }
  );
});

test("rejects out-of-range coordinate pairs as coordinates", () => {
  assert.equal(parseHomeAirfieldCoordinates("91, 9.952"), null);
  assert.equal(parseHomeAirfieldCoordinates("50.497, 181"), null);
});

test("resolves named glider airfields through search", () => {
  assert.deepEqual(
    resolveHomeAirfieldLocation("Wasserkuppe, Gersfeld"),
    {
      kind: "search",
      query: "Wasserkuppe, Gersfeld",
      label: "Wasserkuppe, Gersfeld"
    }
  );
});
