import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFollowedPublicFlightsWhere,
  canFollowPilot,
  parseFollowIntent
} from "../lib/pilot-follow.ts";

test("accepts only explicit follow intents", () => {
  assert.equal(parseFollowIntent("follow"), "follow");
  assert.equal(parseFollowIntent("unfollow"), "unfollow");
  assert.throws(() => parseFollowIntent("remove"), /Invalid follow action/);
});

test("prevents users from following themselves", () => {
  assert.equal(canFollowPilot("viewer", "pilot"), true);
  assert.equal(canFollowPilot("viewer", "viewer"), false);
  assert.equal(canFollowPilot("viewer", ""), false);
});

test("followed feed is restricted to visible approved flights", () => {
  assert.deepEqual(buildFollowedPublicFlightsWhere("viewer"), {
    visibility: "PUBLIC",
    moderationStatus: "APPROVED",
    deletedAt: null,
    user: {
      followers: {
        some: {followerId: "viewer"}
      }
    }
  });
});
