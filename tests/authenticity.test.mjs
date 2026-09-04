import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {canonicalJson, evaluateFlightEvidence, evidenceSha256, parseFlightEvidence, publicKeyFingerprint, validateEd25519PublicJwk, verifyEvidenceSignature} from "../lib/authenticity.ts";

const hashA = "a".repeat(64);
const flight = {id: "flight-1", igcSha256: hashA, simulator: "Condor 2", glider: "Diana 2", weatherMode: "Preset A", startTime: new Date("2026-09-04T10:00:00Z"), durationSeconds: 3600};
const valid = {version: "1.0.0", flightId: "flight-1", igcSha256: hashA, simulator: "Condor 2", simulatorVersion: "2.1", aircraft: "Diana 2", weather: "Preset A", taskPackageId: "task:1", taskPackageSha256: "b".repeat(64), startedAt: "2026-09-04T10:00:00Z", endedAt: "2026-09-04T11:00:00Z", attemptId: "attempt-1", logSha256: "c".repeat(64)};
const policy = [{id: "round-1", evidenceRequired: true, evidenceSimulators: ["Condor 2"], requiredEvidenceFields: ["simulatorVersion", "attemptId", "logSha256"], requireSignedEvidence: true, requiredTaskPackageId: "task:1"}];

test("accepts a valid signed evidence fixture", () => {
  const evidence = parseFlightEvidence(valid);
  const {publicKey, privateKey} = crypto.generateKeyPairSync("ed25519");
  const publicJwk = publicKey.export({format: "jwk"});
  const signature = crypto.sign(null, Buffer.from(canonicalJson(evidence)), privateKey).toString("base64url");
  assert.equal(verifyEvidenceSignature(evidence, signature, publicJwk), true);
  assert.match(publicKeyFingerprint(validateEd25519PublicJwk(publicJwk)), /^[a-f0-9]{64}$/);
  assert.equal(evidenceSha256(evidence).length, 64);
  assert.deepEqual(evaluateFlightEvidence({evidence, flight, signature: {present: true, valid: true}, duplicateAttempt: false, competitions: policy}), {status: "VERIFIED", findings: []});
});

test("flags manipulated evidence without silently discarding it", () => {
  const evidence = parseFlightEvidence({...valid, igcSha256: "d".repeat(64), simulator: "Other", attemptId: "reused"});
  const result = evaluateFlightEvidence({evidence, flight, signature: {present: true, valid: false}, duplicateAttempt: true, competitions: policy});
  assert.equal(result.status, "FLAGGED");
  assert.ok(result.findings.some((finding) => finding.code === "IGC_HASH_MISMATCH"));
  assert.ok(result.findings.some((finding) => finding.code === "SIGNATURE_INVALID"));
  assert.ok(result.findings.some((finding) => finding.code === "ATTEMPT_REUSED"));
});

test("keeps incomplete evidence distinct from invalid evidence", () => {
  const evidence = parseFlightEvidence({...valid, simulatorVersion: null, attemptId: null, logSha256: null});
  const result = evaluateFlightEvidence({evidence, flight, signature: {present: false, valid: false}, duplicateAttempt: false, competitions: policy});
  assert.equal(result.status, "INCOMPLETE");
  assert.ok(result.findings.every((finding) => finding.category === "MISSING"));
});

test("keeps unsupported evidence versions distinct", () => {
  const evidence = parseFlightEvidence({...valid, version: "2.0.0"});
  const result = evaluateFlightEvidence({evidence, flight, signature: {present: true, valid: true}, duplicateAttempt: false, competitions: []});
  assert.equal(result.status, "UNSUPPORTED");
});

test("rejects undeclared evidence and private key material", () => {
  assert.throws(() => parseFlightEvidence({...valid, accessToken: "secret"}), /undeclared_evidence_field/);
  assert.throws(() => validateEd25519PublicJwk({kty: "OKP", crv: "Ed25519", x: "a".repeat(43), d: "secret"}), /invalid_public_key/);
});
