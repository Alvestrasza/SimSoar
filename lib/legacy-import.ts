import path from "node:path";

export const LEGACY_IMPORT_VERSION = 1;
export const OVERWRITE_CONFIRMATION = "REPLACE_EXISTING_FLIGHTS";

export type LegacyImportDecision = "CREATE" | "SKIP_DUPLICATE" | "REPLACE" | "REJECT_BLOCKED";

export function resolveLegacySourcePath(sourceRoot: string, relativePath: string) {
  if (!relativePath.trim() || path.isAbsolute(relativePath)) throw new Error("IGC paths must be non-empty and relative to the source directory.");
  const root = path.resolve(sourceRoot);
  const candidate = path.resolve(root, relativePath);
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("IGC path escapes the source directory.");
  return candidate;
}

export function decideLegacyImport({existing, blocked, overwrite}: {existing: boolean; blocked: boolean; overwrite: boolean}): LegacyImportDecision {
  if (blocked) return "REJECT_BLOCKED";
  if (!existing) return "CREATE";
  return overwrite ? "REPLACE" : "SKIP_DUPLICATE";
}

export function requireOverwriteConfirmation(overwrite: boolean, confirmation?: string) {
  if (overwrite && confirmation !== OVERWRITE_CONFIRMATION) {
    throw new Error(`--overwrite requires --confirm-overwrite=${OVERWRITE_CONFIRMATION}.`);
  }
}

export function summarizeLegacyImport(items: Array<{status: string}>) {
  return {
    total: items.length,
    successes: items.filter((item) => item.status === "IMPORTED" || item.status === "REPLACED").length,
    failures: items.filter((item) => item.status === "FAILED").length,
    skipped: items.filter((item) => item.status === "SKIPPED_DUPLICATE" || item.status === "BLOCKED").length,
    planned: items.filter((item) => item.status.startsWith("WOULD_")).length
  };
}
