import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFlightWhere,
  hasActiveFlightFilters,
  parseFlightFilters
} from "../lib/flight-filters.ts";

test("parses combinable text, date, and numeric filters", () => {
  const filters = parseFlightFilters({
    search: " Alice ",
    simulator: "Condor",
    glider: "ASW",
    competitionClass: "Club",
    dateFrom: "2026-08-01",
    dateTo: "2026-08-31",
    distanceMin: "100",
    distanceMax: "500",
    pointsMin: "50",
    pointsMax: "800",
    speedMin: "70",
    speedMax: "180",
    altitudeMin: "500",
    altitudeMax: "5000"
  });

  assert.equal(filters.search, "Alice");
  assert.equal(filters.simulator, "Condor");
  assert.equal(filters.distanceMin, 100);
  assert.equal(filters.altitudeMax, 5000);
  assert.equal(filters.dateFrom?.toISOString(), "2026-08-01T00:00:00.000Z");
  assert.equal(
    filters.dateToExclusive?.toISOString(),
    "2026-09-01T00:00:00.000Z"
  );
  assert.equal(hasActiveFlightFilters(filters), true);
});

test("builds one combined public-flight database filter", () => {
  const where = buildFlightWhere(
    parseFlightFilters({
      search: "Alice",
      simulator: "MSFS",
      distanceMin: "120",
      pointsMax: "900",
      speedMin: "80",
      altitudeMax: "4500"
    })
  );

  assert.equal(where.visibility, "PUBLIC");
  assert.equal(where.moderationStatus, "APPROVED");
  assert.equal(where.deletedAt, null);
  assert.deepEqual(where.distanceKm, {gte: 120});
  assert.deepEqual(where.olcPoints, {lte: 900});
  assert.deepEqual(where.avgSpeedKmh, {gte: 80});
  assert.deepEqual(where.maxAltitudeM, {lte: 4500});
  assert.equal(where.OR?.length, 2);
});

test("ignores invalid or negative numeric and date inputs", () => {
  const filters = parseFlightFilters({
    distanceMin: "-10",
    pointsMax: "not-a-number",
    dateFrom: "03.09.2026"
  });

  assert.equal(filters.distanceMin, null);
  assert.equal(filters.pointsMax, null);
  assert.equal(filters.dateFrom, null);
  assert.equal(hasActiveFlightFilters(filters), false);
});

test("uses the first value for duplicated URL parameters", () => {
  const filters = parseFlightFilters({
    simulator: ["Condor", "MSFS"]
  });

  assert.equal(filters.simulator, "Condor");
});
