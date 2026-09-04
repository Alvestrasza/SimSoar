import assert from "node:assert/strict";
import test from "node:test";
import {buildHomeFeedWhere} from "../lib/home-feed.ts";

const publicScope = {
  visibility: "PUBLIC",
  moderationStatus: "APPROVED",
  deletedAt: null
};

test("defaults to recent public flights", () => {
  assert.deepEqual(buildHomeFeedWhere(null, null), publicScope);
});

test("limits an authenticated own-flight feed to its owner", () => {
  assert.deepEqual(
    buildHomeFeedWhere("viewer", {homeFeedMode: "OWN"}),
    {...publicScope, userId: "viewer"}
  );
});

test("limits followed feed through follow relationships", () => {
  assert.deepEqual(
    buildHomeFeedWhere("viewer", {homeFeedMode: "FOLLOWING"}),
    {
      ...publicScope,
      user: {followers: {some: {followerId: "viewer"}}}
    }
  );
});

test("anonymous visitors cannot activate a personalized scope", () => {
  assert.deepEqual(
    buildHomeFeedWhere(null, {homeFeedMode: "OWN"}),
    publicScope
  );
});

test("combines simulator and competition class filters", () => {
  assert.deepEqual(
    buildHomeFeedWhere("viewer", {
      homeFeedMode: "PUBLIC",
      homeFeedSimulator: "Condor 2",
      homeFeedCompetitionClass: "Club Klasse"
    }),
    {
      ...publicScope,
      simulator: "Condor 2",
      competitionClass: "Club Klasse"
    }
  );
});
