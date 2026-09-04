import assert from "node:assert/strict";
import test from "node:test";
import {
  displayUploadFileName,
  getBulkUploadLimits,
  validateBatchLimits
} from "../lib/bulk-upload-policy.ts";

test("uses safe configurable bulk upload defaults and overrides", () => {
  assert.deepEqual(getBulkUploadLimits({}), {
    maxFiles: 10,
    maxFileBytes: 10 * 1024 * 1024,
    maxTotalBytes: 50 * 1024 * 1024
  });
  assert.deepEqual(getBulkUploadLimits({
    MAX_IGC_UPLOAD_FILES: "3",
    MAX_IGC_UPLOAD_BYTES: "100",
    MAX_IGC_BULK_UPLOAD_BYTES: "250"
  }), {maxFiles: 3, maxFileBytes: 100, maxTotalBytes: 250});
});

test("rejects empty, excessive-count, and excessive-total batches", () => {
  const limits = {maxFiles: 2, maxFileBytes: 100, maxTotalBytes: 150};
  assert.equal(validateBatchLimits([], limits), "missing-file");
  assert.equal(validateBatchLimits([{size: 1}, {size: 1}, {size: 1}], limits), "too-many-files");
  assert.equal(validateBatchLimits([{size: 100}, {size: 51}], limits), "total-size");
  assert.equal(validateBatchLimits([{size: 100}, {size: 50}], limits), null);
});

test("bounds stored display names", () => {
  assert.equal(displayUploadFileName("  flight.igc  "), "flight.igc");
  assert.equal(displayUploadFileName("x".repeat(200)).length, 160);
});
