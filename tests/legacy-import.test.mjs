import test from "node:test";
import assert from "node:assert/strict";
import {decideLegacyImport, OVERWRITE_CONFIRMATION, requireOverwriteConfirmation, resolveLegacySourcePath, summarizeLegacyImport} from "../lib/legacy-import.ts";

test("keeps dry migration paths inside their source directory", () => {
  assert.match(resolveLegacySourcePath("legacy", "2024/flight.igc"), /legacy[\\/]2024[\\/]flight\.igc$/);
  assert.throws(() => resolveLegacySourcePath("legacy", "../private.igc"), /escapes/);
  assert.throws(() => resolveLegacySourcePath("legacy", ""), /non-empty/);
});

test("skips duplicates unless replacement is explicitly requested", () => {
  assert.equal(decideLegacyImport({existing: true, blocked: false, overwrite: false}), "SKIP_DUPLICATE");
  assert.equal(decideLegacyImport({existing: true, blocked: false, overwrite: true}), "REPLACE");
  assert.equal(decideLegacyImport({existing: false, blocked: false, overwrite: false}), "CREATE");
  assert.equal(decideLegacyImport({existing: false, blocked: true, overwrite: true}), "REJECT_BLOCKED");
});

test("requires a deliberate overwrite confirmation phrase", () => {
  assert.doesNotThrow(() => requireOverwriteConfirmation(false));
  assert.doesNotThrow(() => requireOverwriteConfirmation(true, OVERWRITE_CONFIRMATION));
  assert.throws(() => requireOverwriteConfirmation(true, "yes"), /requires/);
});

test("summarizes success, failure, skip, and dry-run decisions", () => {
  assert.deepEqual(summarizeLegacyImport([{status: "IMPORTED"}, {status: "REPLACED"}, {status: "FAILED"}, {status: "BLOCKED"}, {status: "SKIPPED_DUPLICATE"}, {status: "WOULD_IMPORT"}]), {total: 6, successes: 2, failures: 1, skipped: 2, planned: 1});
});
