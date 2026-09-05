import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {canAccessJournal, encodeJournalCursor, parseJournalCursor, isAfterJournalCursor, parseJournalDate, validateJournalImageInput, validateJournalImageDimensions, journalQuotaAllows, JOURNAL_MAX_USER_BYTES, JOURNAL_MAX_IMAGE_BYTES} from "../lib/journal-policy.ts";
import {prepareJournalImageData} from "../lib/journal-image-processing.ts";
import {writeJournalImage, readJournalImage, removeJournalImage, validateJournalStorageKey} from "../lib/journal-storage.ts";
import {journalErrorMessage, journalMessages} from "../lib/journal-messages.ts";

test("private journal policy allows only the actual owner", () => {
  assert.equal(canAccessJournal("pilot-a", "pilot-a"), true);
  assert.equal(canAccessJournal("pilot-a", "administrator"), false);
  assert.equal(canAccessJournal("pilot-a", null), false);
  assert.equal(canAccessJournal("", ""), false);
});

test("journal pagination cursor validates structure and stable tie ordering", () => {
  const at = new Date("2026-09-05T12:00:00.000Z");
  const cursor = parseJournalCursor(encodeJournalCursor({happenedAt: at, key: "flight:z"}));
  assert.deepEqual(cursor, {at: at.toISOString(), key: "flight:z"});
  assert.equal(isAfterJournalCursor({happenedAt: at, key: "flight:z"}, cursor), false);
  assert.equal(isAfterJournalCursor({happenedAt: at, key: "entry:a"}, cursor), true);
  assert.equal(isAfterJournalCursor({happenedAt: at, key: "task:a"}, cursor), false);
  assert.equal(isAfterJournalCursor({happenedAt: new Date("2026-09-04T00:00:00Z"), key: "task:z"}, cursor), true);
  for (const input of ["%invalid", "x".repeat(513), Buffer.from('{"at":"2026-02-31T00:00:00.000Z","key":"flight:a"}').toString("base64url"), Buffer.from('{"at":"2026-09-05T12:00:00.000Z","key":"audit:a"}').toString("base64url")]) assert.throws(() => parseJournalCursor(input), /invalid_cursor/);
});

test("journal dates reject future dates and nonexistent calendar dates", () => {
  const now = new Date("2026-09-05T06:00:00Z");
  assert.equal(parseJournalDate("2026-09-05", now).toISOString(), "2026-09-05T12:00:00.000Z");
  assert.equal(parseJournalDate("2024-02-29", now).toISOString(), "2024-02-29T12:00:00.000Z");
  for (const date of ["2026-09-06", "2025-02-29", "2026-02-31", "1899-12-31", "2026-9-5", "2026-09-05T00:00:00Z"]) assert.equal(parseJournalDate(date, now), null);
});

test("journal upload policy bounds type, byte size, dimensions and animation", () => {
  assert.throws(() => validateJournalImageInput(Buffer.from("<svg></svg>"), "image/png"), /image_type/);
  assert.throws(() => validateJournalImageInput(Buffer.from([255, 216, 255]), "image/png"), /image_type/);
  assert.throws(() => validateJournalImageInput(Buffer.alloc(JOURNAL_MAX_IMAGE_BYTES + 1), "image/jpeg"), /image_size/);
  validateJournalImageDimensions(5000, 4000);
  for (const [width, height, pages] of [[-1, 100, 1], [1, -1, 1], [0, 1, 1], [8193, 1, 1], [5001, 4000, 1], [100, 100, 2], [1.5, 2, 1]]) assert.throws(() => validateJournalImageDimensions(width, height, pages), /image_dimensions/);
});

test("journal image processing decodes, rotates and strips metadata and trailing payload", async () => {
  const source = await sharp({create: {width: 3, height: 2, channels: 3, background: "red"}}).withMetadata({orientation: 6}).jpeg().toBuffer();
  const marker = "UNTRUSTED_TRAILING_PAYLOAD";
  const output = await prepareJournalImageData(Buffer.concat([source, Buffer.from(marker)]), "image/jpeg");
  const metadata = await sharp(output.buffer).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 2);
  assert.equal(metadata.height, 3);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.orientation, undefined);
  assert.equal(output.buffer.includes(Buffer.from(marker)), false);
  assert.equal(output.sizeBytes, output.buffer.length);
  await assert.rejects(prepareJournalImageData(Buffer.from([255, 216, 255, 0]), "image/jpeg"), /image_invalid/);
});

test("journal quota boundaries allow replacement but reject excessive storage and entry counts", () => {
  assert.equal(journalQuotaAllows({entryCount: 4999, creating: true, imageCount: 4, bytes: JOURNAL_MAX_USER_BYTES}), true);
  assert.equal(journalQuotaAllows({entryCount: 5000, creating: false, imageCount: 4, bytes: JOURNAL_MAX_USER_BYTES}), true);
  for (const input of [{entryCount: 5000, creating: true, imageCount: 0, bytes: 0}, {entryCount: 1, creating: false, imageCount: 5, bytes: 0}, {entryCount: 1, creating: false, imageCount: 1, bytes: JOURNAL_MAX_USER_BYTES + 1}, {entryCount: 1, creating: true, imageCount: 0, bytes: -1}]) assert.equal(journalQuotaAllows(input), false);
});

test("journal storage rejects another owner and traversal, round-trips and deletes only the selected file", async () => {
  const temporaryBase = path.resolve(".private", "test-artifacts");
  await fs.mkdir(temporaryBase, {recursive: true});
  const root = await fs.mkdtemp(path.join(temporaryBase, "journal-"));
  try {
    const bytes = await sharp({create: {width: 2, height: 2, channels: 3, background: "blue"}}).webp().toBuffer();
    const key = await writeJournalImage("pilot-a", bytes, root);
    assert.deepEqual(await readJournalImage(key, "pilot-a", root), bytes);
    assert.throws(() => validateJournalStorageKey(key, "pilot-b"), /invalid_storage_key/);
    await assert.rejects(readJournalImage(key, "pilot-b", root), /invalid_storage_key/);
    await assert.rejects(removeJournalImage(key, "pilot-b", root), /invalid_storage_key/);
    for (const candidate of ["../outside.webp", key.replace("/", "/../"), key.replace(".webp", ".html"), key.replace("/", "\\")]) assert.throws(() => validateJournalStorageKey(candidate, "pilot-a"), /invalid_storage_key/);
    await removeJournalImage(key, "pilot-a", root);
    await assert.rejects(readJournalImage(key, "pilot-a", root), /ENOENT/);
    await removeJournalImage(key, "pilot-a", root);
  } finally {
    if (!root.startsWith(`${temporaryBase}${path.sep}journal-`)) throw new Error("Unsafe test cleanup path");
    await fs.rm(root, {recursive: true});
  }
});

test("journal error messages never return inherited object properties", () => {
  for (const locale of ["de", "en"]) {
    for (const code of ["__proto__", "constructor", "toString", "unknown", ""]) assert.equal(journalErrorMessage(locale, code), journalMessages(locale).errors.save_failed);
    assert.equal(journalErrorMessage(locale, "image_type"), journalMessages(locale).errors.image_type);
  }
});
