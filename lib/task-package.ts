import crypto from "node:crypto";
import {exportTaskToCup} from "./cup.ts";

export const TASK_PACKAGE_FORMAT = "simsoar-task-package" as const;
export const TASK_PACKAGE_SCHEMA_VERSION = "1.0.0" as const;
export const MAX_TASK_PACKAGE_BYTES = 2 * 1024 * 1024;
export const MAX_TASK_PACKAGE_FILES = 16;
export const MAX_TASK_PACKAGE_FILE_BYTES = 1024 * 1024;

const executableExtensions = new Set([
  ".app", ".bat", ".bin", ".cmd", ".com", ".dll", ".dmg", ".exe", ".hta",
  ".jar", ".js", ".lnk", ".msi", ".msp", ".ps1", ".py", ".scr", ".sh", ".vbs"
]);

export type TaskPackageFileDeclaration = {
  path: string;
  kind: "file";
  mediaType: string;
  role: "task" | "metadata";
  size: number;
  sha256: string;
  license: string;
  sourceUrl: string | null;
};

export type TaskPackage = {
  format: typeof TASK_PACKAGE_FORMAT;
  manifest: {
    schemaVersion: typeof TASK_PACKAGE_SCHEMA_VERSION;
    packageId: string;
    createdAt: string;
    task: {
      id: string;
      lineageId: string;
      revision: number;
      name: string;
      description: string | null;
      visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
      distanceKm: number;
      waypointCount: number;
      updatedAt: string;
    };
    compatibility: Array<{simulator: string; minVersion: string; maxVersion: string | null; format: string}>;
    dependencies: Array<{id: string; required: boolean; version: string; sha256: string | null; license: string; sourceUrl: string}>;
    files: TaskPackageFileDeclaration[];
    provenance: {producer: "SimSoar"; taskLineageId: string; taskRevision: number};
  };
  files: Array<{path: string; encoding: "base64"; data: string}>;
};

export class TaskPackageError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

function sha256(value: Buffer) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function assertRecord(value: unknown, code: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TaskPackageError(code);
}

function safePackagePath(value: unknown) {
  if (typeof value !== "string" || !value || value.length > 180 || /[\\\x00-\x1f]/.test(value)) return false;
  if (value.startsWith("/") || /^[a-z]:/i.test(value)) return false;
  const parts = value.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) return false;
  const dot = value.lastIndexOf(".");
  return !executableExtensions.has(dot >= 0 ? value.slice(dot).toLowerCase() : "");
}

function validHttpsUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function parseVersion(value: string) {
  const match = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(value);
  return match ? match.slice(1).map((part) => Number(part ?? 0)) : null;
}

function compareVersions(left: string, right: string) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) throw new TaskPackageError("invalid-compatibility-version");
  for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
}

export function createTaskPackage(task: {
  id: string;
  lineageId: string;
  revision: number;
  name: string;
  description: string | null;
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  totalDistanceKm: number;
  updatedAt: Date;
  waypoints: Array<{name: string | null; code: string | null; lat: number; lon: number; radiusM: number}>;
}, now = new Date()): TaskPackage {
  const cup = Buffer.from(exportTaskToCup({name: task.name, waypoints: task.waypoints}), "utf8");
  const path = "task/task.cup";
  return {
    format: TASK_PACKAGE_FORMAT,
    manifest: {
      schemaVersion: TASK_PACKAGE_SCHEMA_VERSION,
      packageId: `urn:simsoar:task:${task.lineageId}:${task.revision}`,
      createdAt: now.toISOString(),
      task: {
        id: task.id,
        lineageId: task.lineageId,
        revision: task.revision,
        name: task.name,
        description: task.description,
        visibility: task.visibility,
        distanceKm: task.totalDistanceKm,
        waypointCount: task.waypoints.length,
        updatedAt: task.updatedAt.toISOString()
      },
      compatibility: [{simulator: "generic-cup", minVersion: "1.0.0", maxVersion: null, format: "SeeYou CUP"}],
      dependencies: [],
      files: [{path, kind: "file", mediaType: "text/csv; charset=utf-8", role: "task", size: cup.byteLength, sha256: sha256(cup), license: "User-provided task data", sourceUrl: null}],
      provenance: {producer: "SimSoar", taskLineageId: task.lineageId, taskRevision: task.revision}
    },
    files: [{path, encoding: "base64", data: cup.toString("base64")}]
  };
}

export function validateAndMaterializeTaskPackage(value: unknown, target?: {simulator: string; version: string}) {
  let serialized: string;
  try { serialized = JSON.stringify(value); } catch { throw new TaskPackageError("invalid-package"); }
  const serializedSize = Buffer.byteLength(serialized, "utf8");
  if (serializedSize > MAX_TASK_PACKAGE_BYTES) throw new TaskPackageError("package-too-large");
  assertRecord(value, "invalid-package");
  if (value.format !== TASK_PACKAGE_FORMAT) throw new TaskPackageError("unsupported-format");
  assertRecord(value.manifest, "invalid-manifest");
  if (value.manifest.schemaVersion !== TASK_PACKAGE_SCHEMA_VERSION) throw new TaskPackageError("unsupported-schema-version");
  if (typeof value.manifest.packageId !== "string" || !/^urn:simsoar:task:[a-z0-9_-]+:\d+$/i.test(value.manifest.packageId)) throw new TaskPackageError("invalid-package-id");
  if (typeof value.manifest.createdAt !== "string" || !Number.isFinite(Date.parse(value.manifest.createdAt))) throw new TaskPackageError("invalid-created-at");
  assertRecord(value.manifest.task, "invalid-task");
  if (typeof value.manifest.task.id !== "string" || !value.manifest.task.id || typeof value.manifest.task.lineageId !== "string" || !value.manifest.task.lineageId) throw new TaskPackageError("invalid-task-identity");
  if (!Number.isSafeInteger(value.manifest.task.revision) || (value.manifest.task.revision as number) < 1) throw new TaskPackageError("invalid-task-revision");
  if (typeof value.manifest.task.name !== "string" || !value.manifest.task.name || value.manifest.task.name.length > 120) throw new TaskPackageError("invalid-task-name");
  if (!Number.isSafeInteger(value.manifest.task.waypointCount) || (value.manifest.task.waypointCount as number) < 2 || (value.manifest.task.waypointCount as number) > 100) throw new TaskPackageError("invalid-waypoint-count");
  assertRecord(value.manifest.provenance, "invalid-provenance");
  if (value.manifest.provenance.producer !== "SimSoar" || value.manifest.provenance.taskLineageId !== value.manifest.task.lineageId || value.manifest.provenance.taskRevision !== value.manifest.task.revision) throw new TaskPackageError("invalid-provenance");
  if (value.manifest.packageId !== `urn:simsoar:task:${value.manifest.task.lineageId}:${value.manifest.task.revision}`) throw new TaskPackageError("invalid-package-id");
  if (!Array.isArray(value.manifest.compatibility) || !value.manifest.compatibility.length) throw new TaskPackageError("invalid-compatibility");
  for (const entry of value.manifest.compatibility) {
    assertRecord(entry, "invalid-compatibility");
    if (typeof entry.simulator !== "string" || !/^[a-z0-9._-]{1,80}$/i.test(entry.simulator)) throw new TaskPackageError("invalid-compatibility");
    if (typeof entry.minVersion !== "string" || !parseVersion(entry.minVersion)) throw new TaskPackageError("invalid-compatibility-version");
    if (entry.maxVersion !== null && (typeof entry.maxVersion !== "string" || !parseVersion(entry.maxVersion) || compareVersions(entry.minVersion, entry.maxVersion) > 0)) throw new TaskPackageError("invalid-compatibility-version");
    if (typeof entry.format !== "string" || !entry.format || entry.format.length > 120) throw new TaskPackageError("invalid-compatibility");
  }
  if (!Array.isArray(value.manifest.files) || !Array.isArray(value.files)) throw new TaskPackageError("invalid-files");
  if (!value.manifest.files.length || value.manifest.files.length > MAX_TASK_PACKAGE_FILES) throw new TaskPackageError("invalid-file-count");
  if (value.files.length !== value.manifest.files.length) throw new TaskPackageError("undeclared-file");

  const declarations = new Map<string, TaskPackageFileDeclaration>();
  for (const item of value.manifest.files) {
    assertRecord(item, "invalid-file-declaration");
    if (!safePackagePath(item.path)) throw new TaskPackageError("unsafe-file-path");
    if (item.kind !== "file") throw new TaskPackageError("links-not-supported");
    if (typeof item.size !== "number" || !Number.isSafeInteger(item.size) || item.size < 0 || item.size > MAX_TASK_PACKAGE_FILE_BYTES) throw new TaskPackageError("invalid-file-size");
    if (typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(item.sha256)) throw new TaskPackageError("invalid-file-hash");
    if (typeof item.mediaType !== "string" || !item.mediaType.startsWith("text/")) throw new TaskPackageError("unsafe-media-type");
    if (item.role !== "task" && item.role !== "metadata") throw new TaskPackageError("invalid-file-role");
    if (typeof item.license !== "string" || !item.license || item.license.length > 200) throw new TaskPackageError("invalid-license");
    if (item.sourceUrl !== null && !validHttpsUrl(item.sourceUrl)) throw new TaskPackageError("invalid-source-url");
    if (declarations.has(item.path as string)) throw new TaskPackageError("duplicate-file");
    declarations.set(item.path as string, item as unknown as TaskPackageFileDeclaration);
  }

  const materialized = new Map<string, Buffer>();
  for (const item of value.files) {
    assertRecord(item, "invalid-file");
    if (typeof item.path !== "string" || !declarations.has(item.path)) throw new TaskPackageError("undeclared-file");
    if (item.encoding !== "base64" || typeof item.data !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(item.data)) throw new TaskPackageError("invalid-file-encoding");
    if (materialized.has(item.path)) throw new TaskPackageError("duplicate-file");
    const bytes = Buffer.from(item.data, "base64");
    const declaration = declarations.get(item.path)!;
    if (bytes.byteLength !== declaration.size) throw new TaskPackageError("file-size-mismatch");
    if (!crypto.timingSafeEqual(Buffer.from(sha256(bytes), "hex"), Buffer.from(declaration.sha256, "hex"))) throw new TaskPackageError("file-hash-mismatch");
    materialized.set(item.path, bytes);
  }

  if (target) {
    const compatible = value.manifest.compatibility.some((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
      const item = entry as Record<string, unknown>;
      if (item.simulator !== target.simulator || typeof item.minVersion !== "string") return false;
      if (compareVersions(target.version, item.minVersion) < 0) return false;
      return item.maxVersion === null || (typeof item.maxVersion === "string" && compareVersions(target.version, item.maxVersion) <= 0);
    });
    if (!compatible) throw new TaskPackageError("incompatible-target");
  }

  if (Array.isArray(value.manifest.dependencies)) {
    for (const dependency of value.manifest.dependencies) {
      assertRecord(dependency, "invalid-dependency");
      if (typeof dependency.id !== "string" || !/^[a-z0-9._-]{1,120}$/i.test(dependency.id)) throw new TaskPackageError("invalid-dependency-id");
      if (typeof dependency.required !== "boolean" || typeof dependency.version !== "string" || !parseVersion(dependency.version)) throw new TaskPackageError("invalid-dependency-version");
      if (typeof dependency.license !== "string" || !dependency.license || dependency.license.length > 200) throw new TaskPackageError("invalid-dependency-license");
      if (!validHttpsUrl(dependency.sourceUrl)) throw new TaskPackageError("invalid-dependency-source");
      if (dependency.sha256 !== null && (typeof dependency.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(dependency.sha256))) throw new TaskPackageError("invalid-dependency-hash");
    }
  } else throw new TaskPackageError("invalid-dependencies");

  return materialized;
}
