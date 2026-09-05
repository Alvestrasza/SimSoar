import fs from "node:fs/promises";
import {constants} from "node:fs";
import path from "node:path";
import {createHash, randomUUID} from "node:crypto";
import {JOURNAL_MAX_IMAGE_BYTES} from "./journal-policy.ts";

function ownerDirectory(userId: string) {
  return createHash("sha256").update(userId).digest("hex");
}

export function validateJournalStorageKey(storageKey: string, userId: string) {
  if (!/^[a-f0-9]{64}\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.webp$/.test(storageKey) || !storageKey.startsWith(`${ownerDirectory(userId)}/`)) throw new Error("invalid_storage_key");
  return storageKey;
}

async function checkedDirectory(directory: string, create: boolean) {
  if (create) await fs.mkdir(directory, {mode: 0o700}).catch((error: NodeJS.ErrnoException) => { if (error.code !== "EEXIST") throw error; });
  const stat = await fs.lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("invalid_storage_directory");
  return fs.realpath(directory);
}

async function imagePath(storageKey: string, userId: string, uploadDir: string, create: boolean) {
  validateJournalStorageKey(storageKey, userId);
  if (create) await fs.mkdir(path.resolve(uploadDir), {recursive: true, mode: 0o700});
  const upload = await fs.realpath(path.resolve(uploadDir));
  const root = await checkedDirectory(path.join(upload, "journal"), create);
  if (root !== path.join(upload, "journal")) throw new Error("invalid_storage_directory");
  const owner = await checkedDirectory(path.join(root, ownerDirectory(userId)), create);
  if (owner !== path.join(root, ownerDirectory(userId))) throw new Error("invalid_storage_directory");
  return path.join(owner, storageKey.split("/")[1]);
}

export async function writeJournalImage(userId: string, buffer: Buffer, uploadDir = process.env.UPLOAD_DIR ?? "uploads") {
  if (!buffer.length || buffer.length > JOURNAL_MAX_IMAGE_BYTES) throw new Error("image_size");
  const storageKey = `${ownerDirectory(userId)}/${randomUUID()}.webp`;
  const target = await imagePath(storageKey, userId, uploadDir, true);
  await fs.writeFile(target, buffer, {flag: "wx", mode: 0o600});
  return storageKey;
}

export async function readJournalImage(storageKey: string, userId: string, uploadDir = process.env.UPLOAD_DIR ?? "uploads") {
  const target = await imagePath(storageKey, userId, uploadDir, false);
  const file = await fs.open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.nlink !== 1 || stat.size <= 0 || stat.size > JOURNAL_MAX_IMAGE_BYTES) throw new Error("invalid_image_file");
    return await file.readFile();
  } finally { await file.close(); }
}

export async function removeJournalImage(storageKey: string, userId: string, uploadDir = process.env.UPLOAD_DIR ?? "uploads") {
  try {
    const target = await imagePath(storageKey, userId, uploadDir, false);
    const stat = await fs.lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error("invalid_image_file");
    await fs.unlink(target);
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}
