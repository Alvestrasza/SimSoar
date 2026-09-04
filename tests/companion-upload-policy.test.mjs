import test from "node:test";
import assert from "node:assert/strict";
import {COMPANION_MAX_REQUEST_BYTES, CompanionUploadPolicyError, validateCompanionContentLength, validateCompanionFormShape, validateCompanionUploadFields, validateExplicitUploadConfirmation} from "../lib/companion-upload-policy.ts";

test("requires a bounded declared request size", () => {
  assert.equal(validateCompanionContentLength("1024"), 1024);
  assert.throws(() => validateCompanionContentLength(null), (error) => error instanceof CompanionUploadPolicyError && error.code === "content_length_required");
  assert.throws(() => validateCompanionContentLength(String(COMPANION_MAX_REQUEST_BYTES + 1)), /request_too_large/);
});

test("requires explicit confirmation of the exact selected IGC hash", () => {
  const sha = "a".repeat(64);
  assert.doesNotThrow(() => validateExplicitUploadConfirmation(sha, sha));
  assert.throws(() => validateExplicitUploadConfirmation("b".repeat(64), sha), /upload_confirmation_required/);
});

test("accepts exactly one file and rejects undeclared or duplicate fields", () => {
  assert.doesNotThrow(() => validateCompanionFormShape(["igc", "simulator", "visibility"], 1));
  assert.throws(() => validateCompanionFormShape(["igc", "simulator"], 2), /invalid_file_count/);
  assert.throws(() => validateCompanionFormShape(["igc", "simulator", "admin"], 1), /unexpected_field/);
  assert.throws(() => validateCompanionFormShape(["igc", "simulator", "simulator"], 1), /duplicate_field/);
});

test("bounds companion metadata and defaults visibility to private", () => {
  const fields = validateCompanionUploadFields({simulator: "MSFS 2024", comment: "x".repeat(3000)});
  assert.equal(fields.visibility, "PRIVATE");
  assert.equal(fields.comment?.length, 2000);
  assert.throws(() => validateCompanionUploadFields({simulator: "x"}), /invalid_simulator/);
});
