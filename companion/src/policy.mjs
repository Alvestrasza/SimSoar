import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";

export const MAX_PACKAGE_BYTES = 2 * 1024 * 1024;
export const MAX_IGC_BYTES = 10 * 1024 * 1024;
const forbiddenExtensions = new Set([".app", ".bat", ".bin", ".cmd", ".com", ".dll", ".dmg", ".exe", ".hta", ".jar", ".js", ".lnk", ".msi", ".msp", ".ps1", ".py", ".scr", ".sh", ".vbs"]);

export class CompanionPolicyError extends Error { constructor(code) { super(code); this.code = code; } }
export const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const canonicalJson = (value) => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonicalJson).join(",")}]` : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
const regexEscape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function validateApprovalRoot(candidate) {
  const resolved = path.resolve(candidate);
  if (resolved === path.parse(resolved).root || resolved.toLowerCase() === path.resolve(os.homedir()).toLowerCase()) throw new CompanionPolicyError("unsafe_approval_root");
  return resolved;
}

export function resolveApprovedRoot(candidate, approvedRoots) {
  const resolved = path.resolve(candidate);
  const approved = approvedRoots.map((root) => path.resolve(root));
  if (!approved.some((root) => resolved === root)) throw new CompanionPolicyError("root_not_approved");
  return resolved;
}

export function safeRelativePackagePath(value) {
  if (typeof value !== "string" || !value || value.length > 240 || value.includes("\\") || value.includes("\0") || path.posix.isAbsolute(value) || /^[A-Za-z]:/.test(value)) throw new CompanionPolicyError("unsafe_package_path");
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === ".." || normalized.startsWith("../") || forbiddenExtensions.has(path.posix.extname(normalized).toLowerCase())) throw new CompanionPolicyError("unsafe_package_path");
  return normalized;
}

export function validateTaskPackage(buffer, simulator) {
  if (!Buffer.isBuffer(buffer) || buffer.length <= 0 || buffer.length > MAX_PACKAGE_BYTES) throw new CompanionPolicyError("invalid_package_size");
  let pkg;
  try { pkg = JSON.parse(buffer.toString("utf8")); } catch { throw new CompanionPolicyError("invalid_package_json"); }
  if (pkg?.format !== "simsoar-task-package" || pkg?.manifest?.schemaVersion !== "1.0.0" || !Array.isArray(pkg.manifest.files) || !Array.isArray(pkg.files)) throw new CompanionPolicyError("unsupported_package");
  if (!pkg.manifest.compatibility?.some((item) => typeof item?.simulator === "string" && item.simulator.toLowerCase() === simulator.toLowerCase())) throw new CompanionPolicyError("incompatible_simulator");
  if (pkg.manifest.files.length > 16 || pkg.files.length !== pkg.manifest.files.length) throw new CompanionPolicyError("invalid_file_manifest");
  const payloadEntries = pkg.files.map((file) => [safeRelativePackagePath(file.path), file]);
  const payloads = new Map(payloadEntries);
  if (payloads.size !== payloadEntries.length) throw new CompanionPolicyError("duplicate_package_path");
  const declaredPaths = new Set();
  const files = pkg.manifest.files.map((declaration) => {
    const relativePath = safeRelativePackagePath(declaration.path);
    if (declaredPaths.has(relativePath)) throw new CompanionPolicyError("duplicate_package_path");
    declaredPaths.add(relativePath);
    if (declaration.kind !== "file" || declaration.size > 1024 * 1024 || typeof declaration.sha256 !== "string") throw new CompanionPolicyError("invalid_file_manifest");
    const payload = payloads.get(relativePath);
    if (!payload || payload.encoding !== "base64" || typeof payload.data !== "string") throw new CompanionPolicyError("missing_package_file");
    const content = Buffer.from(payload.data, "base64");
    if (content.length !== declaration.size || sha256(content) !== declaration.sha256) throw new CompanionPolicyError("package_hash_mismatch");
    return {relativePath, content};
  });
  return {packageId: pkg.manifest.packageId, task: pkg.manifest.task, files, packageSha256: sha256(buffer)};
}

export function sanitizeDiagnostic(value, userDirectory = "") {
  let text = String(value).replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [REDACTED]").replace(/([?&](?:token|code|secret|key)=)[^&\s]+/gi, "$1[REDACTED]");
  if (userDirectory) {
    const resolved = path.resolve(userDirectory);
    for (const variant of [resolved, resolved.replace(/\\/g, "/"), resolved.replace(/\//g, "\\")]) text = text.replace(new RegExp(regexEscape(variant), "gi"), "[USER_DIR]");
  }
  return text.slice(0, 2000);
}

export function verifySignedUpdateManifest(manifest, artifact, publicKeyJwk) {
  if (!manifest || typeof manifest !== "object" || manifest.algorithm !== "Ed25519" || typeof manifest.signature !== "string" || typeof manifest.artifactSha256 !== "string" || sha256(artifact) !== manifest.artifactSha256) throw new CompanionPolicyError("invalid_update_manifest");
  const signed = {version: manifest.version, artifactSha256: manifest.artifactSha256, publishedAt: manifest.publishedAt};
  try {
    const key = crypto.createPublicKey({key: publicKeyJwk, format: "jwk"});
    if (!crypto.verify(null, Buffer.from(canonicalJson(signed)), key, Buffer.from(manifest.signature, "base64url"))) throw new Error("signature");
  } catch { throw new CompanionPolicyError("invalid_update_signature"); }
  return signed;
}
