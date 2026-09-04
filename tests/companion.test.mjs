import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import {CompanionPolicyError, resolveApprovedRoot, safeRelativePackagePath, sanitizeDiagnostic, sha256, validateApprovalRoot, validateTaskPackage, verifySignedUpdateManifest} from "../companion/src/policy.mjs";

function taskPackage(overrides = {}) {
  const content = Buffer.from("task-data");
  return Buffer.from(JSON.stringify({format: "simsoar-task-package", manifest: {schemaVersion: "1.0.0", packageId: "task:1", task: {revision: 1}, compatibility: [{simulator: "MSFS 2024"}], files: [{path: "task.cup", kind: "file", size: content.length, sha256: sha256(content)}]}, files: [{path: "task.cup", encoding: "base64", data: content.toString("base64")}], ...overrides}));
}

test("requires exact approved roots and safe data-only paths", () => {
  const root = path.resolve("approved");
  assert.equal(resolveApprovedRoot(root, [root]), root);
  assert.throws(() => resolveApprovedRoot(path.join(root, "child"), [root]), /root_not_approved/);
  assert.throws(() => validateApprovalRoot(path.parse(root).root), /unsafe_approval_root/);
  assert.equal(safeRelativePackagePath("tasks/flight.cup"), "tasks/flight.cup");
  for (const unsafe of ["../escape.cup", "C:/absolute.cup", "script.ps1", "task\\file.cup"]) assert.throws(() => safeRelativePackagePath(unsafe), CompanionPolicyError);
});

test("validates package compatibility and every file hash", () => {
  assert.equal(validateTaskPackage(taskPackage(), "MSFS 2024").files.length, 1);
  assert.throws(() => validateTaskPackage(taskPackage(), "Condor 2"), /incompatible_simulator/);
  const corrupt = JSON.parse(taskPackage().toString("utf8")); corrupt.files[0].data = Buffer.from("changed").toString("base64");
  assert.throws(() => validateTaskPackage(Buffer.from(JSON.stringify(corrupt)), "MSFS 2024"), /package_hash_mismatch/);
});

test("redacts credentials and user directories from diagnostics", () => {
  const redacted = sanitizeDiagnostic("Bearer secret.token ?token=secret C:/Users/Test/private", "C:/Users/Test");
  assert.doesNotMatch(redacted, /secret\.token|token=secret|Users\/Test/);
});

test("accepts only a matching Ed25519 signed update manifest", () => {
  const {publicKey, privateKey} = crypto.generateKeyPairSync("ed25519");
  const artifact = Buffer.from("release");
  const signed = {version: "0.1.1", artifactSha256: sha256(artifact), publishedAt: "2026-09-04T00:00:00Z"};
  const canonical = `{${Object.keys(signed).sort().map((key) => `${JSON.stringify(key)}:${JSON.stringify(signed[key])}`).join(",")}}`;
  const manifest = {...signed, algorithm: "Ed25519", signature: crypto.sign(null, Buffer.from(canonical), privateKey).toString("base64url")};
  assert.equal(verifySignedUpdateManifest(manifest, artifact, publicKey.export({format: "jwk"})).version, "0.1.1");
  assert.throws(() => verifySignedUpdateManifest(manifest, Buffer.from("tampered"), publicKey.export({format: "jwk"})), /invalid_update_manifest/);
});
