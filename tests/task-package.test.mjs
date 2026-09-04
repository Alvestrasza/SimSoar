import assert from "node:assert/strict";
import test from "node:test";
import {createTaskPackage, TaskPackageError, validateAndMaterializeTaskPackage} from "../lib/task-package.ts";

const task = {
  id: "task-1",
  lineageId: "lineage-1",
  revision: 3,
  name: "Alpine triangle",
  description: "A test task",
  visibility: "PUBLIC",
  totalDistanceKm: 123.4,
  updatedAt: new Date("2026-09-04T12:00:00.000Z"),
  waypoints: [
    {name: "Start", code: "START", lat: 48, lon: 11, radiusM: 500},
    {name: "Finish", code: "FIN", lat: 49, lon: 12, radiusM: 500}
  ]
};

function expectCode(callback, code) {
  assert.throws(callback, (error) => error instanceof TaskPackageError && error.code === code);
}

test("creates and validates a versioned data-only task package", () => {
  const value = createTaskPackage(task, new Date("2026-09-04T13:00:00.000Z"));
  const files = validateAndMaterializeTaskPackage(value, {simulator: "generic-cup", version: "1.0.0"});
  assert.equal(value.manifest.packageId, "urn:simsoar:task:lineage-1:3");
  assert.match(files.get("task/task.cup").toString("utf8"), /Alpine triangle/);
});

test("rejects corrupt payloads", () => {
  const value = createTaskPackage(task);
  value.files[0].data = Buffer.from("modified", "utf8").toString("base64");
  expectCode(() => validateAndMaterializeTaskPackage(value), "file-size-mismatch");
});

test("rejects traversal, absolute paths, executables, links, and undeclared files", () => {
  for (const path of ["../task.cup", "/task.cup", "C:/task.cup", "task\\task.cup", "task/run.exe"]) {
    const value = createTaskPackage(task);
    value.manifest.files[0].path = path;
    value.files[0].path = path;
    expectCode(() => validateAndMaterializeTaskPackage(value), "unsafe-file-path");
  }

  const linked = createTaskPackage(task);
  linked.manifest.files[0].kind = "symlink";
  expectCode(() => validateAndMaterializeTaskPackage(linked), "links-not-supported");

  const undeclared = createTaskPackage(task);
  undeclared.files.push({path: "extra.txt", encoding: "base64", data: ""});
  expectCode(() => validateAndMaterializeTaskPackage(undeclared), "undeclared-file");
});

test("rejects oversized declared files and unsupported package versions", () => {
  const oversized = createTaskPackage(task);
  oversized.manifest.files[0].size = 1024 * 1024 + 1;
  expectCode(() => validateAndMaterializeTaskPackage(oversized), "invalid-file-size");

  const future = createTaskPackage(task);
  future.manifest.schemaVersion = "2.0.0";
  expectCode(() => validateAndMaterializeTaskPackage(future), "unsupported-schema-version");
});

test("rejects incompatible simulator targets and unsafe dependency sources", () => {
  const value = createTaskPackage(task);
  expectCode(() => validateAndMaterializeTaskPackage(value, {simulator: "condor", version: "2.0.0"}), "incompatible-target");

  value.manifest.dependencies.push({id: "weather", required: false, version: "1.0.0", sha256: null, license: "Example", sourceUrl: "http://example.test/weather"});
  expectCode(() => validateAndMaterializeTaskPackage(value), "invalid-dependency-source");
});
