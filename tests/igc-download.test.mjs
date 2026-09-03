import assert from "node:assert/strict";
import test from "node:test";

import {
  buildIgcFileName,
  canPublicDownload,
  resolveIgcDownloadMode,
  safeDownloadPart
} from "../lib/igc-download.ts";

const activePublicFlight = {
  userId: "owner-1",
  visibility: "PUBLIC",
  moderationStatus: "APPROVED",
  deletedAt: null,
  publicIgcDownloadEnabled: true
};

test("builds a safe filename with date, callsign, and flight id", () => {
  assert.equal(
    buildIgcFileName({
      id: "flight-42",
      pilotCallsign: "Alice / ../ A-01",
      startTime: new Date("2026-09-03T12:34:56.000Z"),
      createdAt: new Date("2026-09-02T00:00:00.000Z")
    }),
    "2026-09-03_alice-..-a-01_flight-42.igc"
  );
  assert.equal(safeDownloadPart("../../", "pilot"), "pilot");
});

test("allows administrators and owners independently of public sharing", () => {
  const protectedFlight = {
    ...activePublicFlight,
    visibility: "PRIVATE",
    moderationStatus: "PENDING",
    deletedAt: new Date("2026-09-03T00:00:00.000Z"),
    publicIgcDownloadEnabled: false
  };

  assert.equal(
    resolveIgcDownloadMode(protectedFlight, {
      userId: "admin-1",
      isAdmin: true
    }),
    "admin"
  );
  assert.equal(
    resolveIgcDownloadMode(protectedFlight, {
      userId: "owner-1",
      isAdmin: false
    }),
    "owner"
  );
});

test("allows anonymous download only for explicitly shared active flights", () => {
  assert.equal(canPublicDownload(activePublicFlight), true);
  assert.equal(
    resolveIgcDownloadMode(activePublicFlight, {
      userId: null,
      isAdmin: false
    }),
    "public"
  );
});

test("denies public download for private, moderated, deleted, or disabled flights", () => {
  const protectedVariants = [
    {...activePublicFlight, visibility: "PRIVATE"},
    {...activePublicFlight, moderationStatus: "PENDING"},
    {...activePublicFlight, moderationStatus: "HIDDEN"},
    {...activePublicFlight, deletedAt: new Date("2026-09-03T00:00:00.000Z")},
    {...activePublicFlight, publicIgcDownloadEnabled: false}
  ];

  for (const flight of protectedVariants) {
    assert.equal(canPublicDownload(flight), false);
    assert.equal(
      resolveIgcDownloadMode(flight, {
        userId: "viewer-1",
        isAdmin: false
      }),
      null
    );
  }
});

test("uses the creation date when a flight has no start time", () => {
  assert.equal(
    buildIgcFileName({
      id: "flight-7",
      pilotCallsign: "D-1234",
      startTime: null,
      createdAt: new Date("2026-08-31T22:00:00.000Z")
    }),
    "2026-08-31_d-1234_flight-7.igc"
  );
});
