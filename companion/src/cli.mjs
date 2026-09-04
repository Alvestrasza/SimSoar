#!/usr/bin/env node
import fs from "node:fs/promises";
import fsSync from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import {configPath, loadConfig, saveConfig} from "./config.mjs";
import {MAX_IGC_BYTES, CompanionPolicyError, resolveApprovedRoot, sanitizeDiagnostic, sha256, validateApprovalRoot, validateTaskPackage, verifySignedUpdateManifest} from "./policy.mjs";

const args = process.argv.slice(2);
const command = args.shift();
const option = (name) => { const prefix = `--${name}=`; const item = args.find((arg) => arg.startsWith(prefix)); return item ? item.slice(prefix.length) : null; };
const required = (name) => { const value = option(name); if (!value) throw new CompanionPolicyError(`missing_${name}`); return value; };
const configFile = option("config") || configPath();
const config = await loadConfig(configFile);

function print(value) { process.stdout.write(`${value}\n`); }
function requireConfirm(flag) { if (!args.includes(`--${flag}`)) throw new CompanionPolicyError(`explicit_${flag}_required`); }

async function approveRoot(kind) {
  requireConfirm("confirm");
  const resolved = validateApprovalRoot(required("path"));
  const stat = await fs.stat(resolved);
  if (!stat.isDirectory()) throw new CompanionPolicyError("approved_root_not_directory");
  const property = kind === "install" ? "approvedInstallRoots" : "approvedResultRoots";
  config[property] = [...new Set([...(config[property] || []).map(path.resolve), resolved])];
  await saveConfig(config, configFile);
  print(`Approved ${kind} root: ${sanitizeDiagnostic(resolved, os.homedir())}`);
}

async function detect() {
  const candidates = process.platform === "win32" ? [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Packages", "Microsoft.FlightSimulator_8wekyb3d8bbwe", "LocalCache", "Packages", "Community"),
    process.env.APPDATA && path.join(process.env.APPDATA, "Microsoft Flight Simulator", "Packages", "Community"),
    process.env.USERPROFILE && path.join(process.env.USERPROFILE, "Documents", "Condor", "FlightPlans")
  ].filter(Boolean) : [path.join(os.homedir(), ".local", "share", "simsoar")];
  const results = [];
  for (const candidate of candidates) { try { if ((await fs.stat(candidate)).isDirectory()) results.push(path.resolve(candidate)); } catch {} }
  print(JSON.stringify({platform: process.platform, candidates: results.map((item) => sanitizeDiagnostic(item, os.homedir())), approved: false}, null, 2));
}

async function installPackage() {
  requireConfirm("confirm");
  const root = resolveApprovedRoot(required("root"), config.approvedInstallRoots || []);
  const packagePath = path.resolve(required("package"));
  const buffer = await fs.readFile(packagePath);
  const validated = validateTaskPackage(buffer, required("simulator"));
  if (required("confirm-package-sha") !== validated.packageSha256) throw new CompanionPolicyError("package_confirmation_mismatch");
  const backupRoot = path.join(root, ".simsoar-backup", new Date().toISOString().replace(/[:.]/g, "-"));
  for (const file of validated.files) {
    const destination = path.resolve(root, ...file.relativePath.split("/"));
    if (!destination.startsWith(`${root}${path.sep}`)) throw new CompanionPolicyError("unsafe_package_path");
    try { const existing = await fs.readFile(destination); await fs.mkdir(path.dirname(path.join(backupRoot, file.relativePath)), {recursive: true}); await fs.writeFile(path.join(backupRoot, file.relativePath), existing, {flag: "wx"}); } catch (error) { if (error?.code !== "ENOENT") throw error; }
    await fs.mkdir(path.dirname(destination), {recursive: true});
    await fs.writeFile(destination, file.content, {flag: "w", mode: 0o600});
  }
  print(JSON.stringify({installed: true, packageId: validated.packageId, packageSha256: validated.packageSha256, files: validated.files.map((item) => item.relativePath), rollbackBackup: sanitizeDiagnostic(backupRoot, os.homedir())}, null, 2));
}

async function scanResults() {
  const root = resolveApprovedRoot(required("root"), config.approvedResultRoots || []);
  const files = (await fs.readdir(root, {withFileTypes: true})).filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".igc")).slice(0, 1000);
  const rows = [];
  for (const entry of files) { const full = path.join(root, entry.name); const stat = await fs.stat(full); if (stat.size > 0 && stat.size <= MAX_IGC_BYTES) rows.push({name: entry.name, bytes: stat.size, sha256: sha256(await fs.readFile(full))}); }
  print(JSON.stringify({root: sanitizeDiagnostic(root, os.homedir()), automaticUpload: false, results: rows}, null, 2));
}

async function watchResults() {
  const root = resolveApprovedRoot(required("root"), config.approvedResultRoots || []);
  print("Watching approved result root. New files are listed only; uploads always require a separate confirmed command.");
  fsSync.watch(root, {persistent: true}, (_event, name) => { if (name?.toLowerCase().endsWith(".igc")) print(`IGC candidate: ${sanitizeDiagnostic(name)}`); });
}

async function readTokenFromStdin() {
  if (!args.includes("--token-stdin")) throw new CompanionPolicyError("token_stdin_required");
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const token = Buffer.concat(chunks).toString("utf8").trim();
  if (!token || token.length > 16_384) throw new CompanionPolicyError("invalid_access_token");
  return token;
}

async function uploadResult() {
  requireConfirm("confirm");
  const filePath = path.resolve(required("file"));
  const parent = resolveApprovedRoot(path.dirname(filePath), config.approvedResultRoots || []);
  if (path.dirname(filePath) !== parent || path.extname(filePath).toLowerCase() !== ".igc") throw new CompanionPolicyError("result_not_approved");
  const buffer = await fs.readFile(filePath);
  if (!buffer.length || buffer.length > MAX_IGC_BYTES) throw new CompanionPolicyError("invalid_igc_size");
  const digest = sha256(buffer);
  if (required("confirm-upload") !== digest) throw new CompanionPolicyError("upload_confirmation_mismatch");
  const token = await readTokenFromStdin();
  const form = new FormData();
  form.set("igc", new Blob([buffer], {type: "application/x-igc"}), path.basename(filePath));
  form.set("simulator", required("simulator"));
  form.set("visibility", option("visibility") || "PRIVATE");
  const response = await fetch(new URL("/api/v1/flights/upload", config.apiBaseUrl), {method: "POST", headers: {Authorization: `Bearer ${token}`, "Idempotency-Key": crypto.randomUUID(), "X-SimSoar-Upload-Confirmation": digest}, body: form});
  const body = await response.json().catch(() => ({error: {code: "invalid_response"}}));
  if (!response.ok) throw new CompanionPolicyError(body?.error?.code || `upload_http_${response.status}`);
  print(JSON.stringify(body, null, 2));
}

async function verifyUpdate() {
  const manifest = JSON.parse(await fs.readFile(required("manifest"), "utf8"));
  const artifact = await fs.readFile(required("artifact"));
  const publicKeyJwk = config.updatePublicKeyJwk;
  if (!publicKeyJwk) throw new CompanionPolicyError("update_key_not_configured");
  print(JSON.stringify({verified: true, ...verifySignedUpdateManifest(manifest, artifact, publicKeyJwk)}, null, 2));
}

try {
  if (command === "init") { requireConfirm("confirm"); const api = new URL(required("api")); if (api.protocol !== "https:") throw new CompanionPolicyError("https_api_required"); config.apiBaseUrl = api.origin; await saveConfig(config, configFile); print("Companion configuration initialized. No credentials were stored."); }
  else if (command === "detect") await detect();
  else if (command === "approve-install-root") await approveRoot("install");
  else if (command === "approve-result-root") await approveRoot("result");
  else if (command === "install") await installPackage();
  else if (command === "scan") await scanResults();
  else if (command === "watch") await watchResults();
  else if (command === "upload") await uploadResult();
  else if (command === "verify-update") await verifyUpdate();
  else print("Commands: init, detect, approve-install-root, approve-result-root, install, scan, watch, upload, verify-update");
} catch (error) {
  process.stderr.write(`${sanitizeDiagnostic(error instanceof CompanionPolicyError ? error.code : "companion_failed", os.homedir())}\n`);
  process.exitCode = 1;
}
