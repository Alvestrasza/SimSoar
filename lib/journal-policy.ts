import {detectStoryImageType} from "./flight-story.ts";

export const JOURNAL_PAGE_SIZE = 30;
export const JOURNAL_MAX_IMAGES = 4;
export const JOURNAL_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const JOURNAL_MAX_PIXELS = 20_000_000;
export const JOURNAL_MAX_DIMENSION = 8192;
export const JOURNAL_MAX_USER_BYTES = 500 * 1024 * 1024;
export const JOURNAL_MAX_ENTRIES = 5000;
export const JOURNAL_KINDS = ["entry", "flight", "task", "club", "competition", "league", "follow", "badge", "comment", "like", "cup", "segment"] as const;
export type JournalKind = typeof JOURNAL_KINDS[number];
export type JournalCursor = {at: string; key: string};

export function canAccessJournal(ownerId: string, viewerId: string | null | undefined) {
  return Boolean(ownerId && viewerId && ownerId === viewerId);
}

export function parseJournalCursor(value: unknown): JournalCursor | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid_cursor");
  try {
    const cursor: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) throw new Error();
    const {at, key} = cursor as Record<string, unknown>;
    if (typeof at !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(at) || new Date(at).toISOString() !== at) throw new Error();
    if (typeof key !== "string" || !/^[a-z]+:[A-Za-z0-9_-]{1,128}$/.test(key) || !JOURNAL_KINDS.includes(key.split(":")[0] as JournalKind)) throw new Error();
    return {at, key};
  } catch { throw new Error("invalid_cursor"); }
}

export function encodeJournalCursor(item: {happenedAt: Date; key: string}): string {
  return Buffer.from(JSON.stringify({at: item.happenedAt.toISOString(), key: item.key})).toString("base64url");
}

export function isAfterJournalCursor(item: {happenedAt: Date; key: string}, cursor: JournalCursor): boolean {
  const at = item.happenedAt.toISOString();
  return at < cursor.at || (at === cursor.at && item.key < cursor.key);
}

export function parseJournalDate(value: string, now = new Date()): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || value < "1900-01-01" || value > now.toISOString().slice(0, 10)) return null;
  return date;
}

export function validateJournalImageInput(buffer: Buffer, declaredType: string): void {
  if (buffer.length === 0 || buffer.length > JOURNAL_MAX_IMAGE_BYTES) throw new Error("image_size");
  const detected = detectStoryImageType(buffer);
  if (!detected || (declaredType && declaredType !== detected.mimeType)) throw new Error("image_type");
}

export function validateJournalImageDimensions(width: number | undefined, height: number | undefined, pages = 1): void {
  if (!width || !height || width < 1 || height < 1 || !Number.isInteger(width) || !Number.isInteger(height) || width > JOURNAL_MAX_DIMENSION || height > JOURNAL_MAX_DIMENSION || width * height > JOURNAL_MAX_PIXELS || pages !== 1) throw new Error("image_dimensions");
}

export function journalQuotaAllows({entryCount, creating, imageCount, bytes}: {entryCount: number; creating: boolean; imageCount: number; bytes: number}) {
  return Number.isSafeInteger(entryCount) && entryCount >= 0 && entryCount + (creating ? 1 : 0) <= JOURNAL_MAX_ENTRIES &&
    Number.isSafeInteger(imageCount) && imageCount >= 0 && imageCount <= JOURNAL_MAX_IMAGES &&
    Number.isSafeInteger(bytes) && bytes >= 0 && bytes <= JOURNAL_MAX_USER_BYTES;
}
