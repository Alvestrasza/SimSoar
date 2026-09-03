import assert from "node:assert/strict";
import test from "node:test";
import {shouldCreateNotification} from "../lib/notification-policy.ts";

test("creates notifications for a different recipient", () => {
  assert.equal(shouldCreateNotification("owner", "viewer"), true);
  assert.equal(shouldCreateNotification("owner", null), true);
});

test("does not notify users about their own actions", () => {
  assert.equal(shouldCreateNotification("owner", "owner"), false);
  assert.equal(shouldCreateNotification("", "viewer"), false);
});
