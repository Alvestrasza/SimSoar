import assert from "node:assert/strict";
import test from "node:test";
import {
  canDeleteFlightComment,
  canInteractWithFlight
} from "../lib/flight-community.ts";

test("allows community interaction only on active approved public flights", () => {
  assert.equal(canInteractWithFlight({visibility: "PUBLIC", moderationStatus: "APPROVED", deletedAt: null}), true);
  assert.equal(canInteractWithFlight({visibility: "PRIVATE", moderationStatus: "APPROVED", deletedAt: null}), false);
  assert.equal(canInteractWithFlight({visibility: "PUBLIC", moderationStatus: "HIDDEN", deletedAt: null}), false);
  assert.equal(canInteractWithFlight({visibility: "PUBLIC", moderationStatus: "APPROVED", deletedAt: "2026-09-03"}), false);
});

test("allows comment deletion by author, flight owner, or moderator", () => {
  assert.equal(canDeleteFlightComment("author", "author", "owner", false), true);
  assert.equal(canDeleteFlightComment("owner", "author", "owner", false), true);
  assert.equal(canDeleteFlightComment("moderator", "author", "owner", true), true);
  assert.equal(canDeleteFlightComment("viewer", "author", "owner", false), false);
});
