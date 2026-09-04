import assert from "node:assert/strict";
import test from "node:test";
import {bindUploadPilotIdentity} from "../lib/upload-identity.ts";

test("binds uploads to the authenticated profile callsign", () => {
  assert.deepEqual(
    bindUploadPilotIdentity({simulator: "Condor 2"}, " ALICE "),
    {simulator: "Condor 2", pilotCallsign: "ALICE"}
  );
});

test("discards a forged submitted callsign", () => {
  assert.deepEqual(
    bindUploadPilotIdentity({pilotCallsign: "VICTIM", simulator: "Condor 2"}, "ALICE"),
    {simulator: "Condor 2", pilotCallsign: "ALICE"}
  );
});

test("rejects uploads without a valid profile callsign", () => {
  assert.throws(() => bindUploadPilotIdentity({simulator: "Condor 2"}, null));
  assert.throws(() => bindUploadPilotIdentity({simulator: "Condor 2"}, "A"));
  assert.throws(() => bindUploadPilotIdentity({simulator: "Condor 2"}, "A".repeat(41)));
});
