import assert from "node:assert/strict";
import test from "node:test";

import {
  homeAirfieldSearchQuery,
  isIcaoCode,
  normalizeHomeAirfield
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
