"use server";

import {z} from "zod";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {writeAuditLog} from "@/lib/audit";
import {prepareJournalImage} from "@/lib/journal-images";
import {JOURNAL_MAX_IMAGES, JOURNAL_MAX_IMAGE_BYTES, journalQuotaAllows, parseJournalDate} from "@/lib/journal-policy";
import {removeJournalImage, writeJournalImage} from "@/lib/journal-storage";
import {FixedWindowRateLimiter} from "@/lib/public-api";

const limiterGlobal = globalThis as typeof globalThis & {simSoarJournalLimiter?: FixedWindowRateLimiter};
const mutationLimiter = limiterGlobal.simSoarJournalLimiter ??= new FixedWindowRateLimiter(12, 60_000);

const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const entrySchema = z.object({
  id: z.union([idSchema, z.literal("")]),
  version: z.coerce.number().int().min(0).max(2147483646),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(10000),
  date: z.string().length(10),
  removeImageIds: z.array(idSchema).max(JOURNAL_MAX_IMAGES)
});
const errors = new Set(["invalid_fields", "image_count", "image_size", "image_type", "image_dimensions", "image_invalid", "quota", "not_found", "conflict", "rate_limit"]);

function localeOf(data: FormData) { return data.get("locale") === "en" ? "en" : "de"; }
function errorCode(error: unknown) {
  const code = error instanceof Error && errors.has(error.message) ? error.message : "save_failed";
  if (code === "save_failed") console.error("Journal mutation failed.", {code: (error as {code?: string})?.code ?? "unknown"});
  return code;
}
function failure(locale: string, error: unknown): never { redirect(`/${locale}/journal?error=${errorCode(error)}`); }
async function cleanImages(keys: string[], userId: string) {
  const results = await Promise.allSettled(keys.map((key) => removeJournalImage(key, userId)));
  if (results.some((result) => result.status === "rejected")) console.error("Journal file cleanup incomplete.", {count: results.filter((result) => result.status === "rejected").length});
}

export async function saveJournalEntryAction(_previousState: {error: string | null}, formData: FormData): Promise<{error: string | null}> {
  const session = await auth();
  const locale = localeOf(formData);
  if (!session?.user?.id) redirect(`/${locale}/login`);
  const userId = session.user.id;
  const written: string[] = [];
  let removed: string[] = [];
  let entryId = "";
  let creating = false;
  let imageCount = 0;
  try {
    if (!mutationLimiter.consume(userId).allowed) throw new Error("rate_limit");
    const parsed = entrySchema.safeParse({id: formData.get("id") ?? "", version: formData.get("version") ?? 0, title: formData.get("title"), body: formData.get("body"), date: formData.get("date"), removeImageIds: formData.getAll("removeImageIds")});
    if (!parsed.success) throw new Error("invalid_fields");
    const input = parsed.data;
    const occurredAt = parseJournalDate(input.date);
    if (!occurredAt) throw new Error("invalid_fields");
    creating = input.id === "";
    if ((creating && input.version !== 0) || (!creating && input.version < 1)) throw new Error("invalid_fields");
    if (!creating) {
      const current = await prisma.journalEntry.findFirst({where: {id: input.id, userId}, select: {version: true}});
      if (!current) throw new Error("not_found");
      if (current.version !== input.version) throw new Error("conflict");
    }
    const rawFiles = formData.getAll("images");
    if (rawFiles.some((value) => !(value instanceof File))) throw new Error("image_type");
    const files = rawFiles.filter((value): value is File => value instanceof File && value.size > 0);
    if (files.length > JOURNAL_MAX_IMAGES) throw new Error("image_count");
    if (files.some((file) => file.size > JOURNAL_MAX_IMAGE_BYTES)) throw new Error("image_size");
    const prepared: Array<{storageKey: string; sizeBytes: number; width: number; height: number}> = [];
    for (const file of files) {
      const image = await prepareJournalImage(file);
      const storageKey = await writeJournalImage(userId, image.buffer);
      written.push(storageKey);
      prepared.push({storageKey, sizeBytes: image.sizeBytes, width: image.width, height: image.height});
    }
    await prisma.$transaction(async (tx) => {
      // Serialize this owner's entry/image changes, including quotas, across nodes.
      const owners = await tx.$queryRaw<Array<{id: string}>>`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      if (owners.length !== 1) throw new Error("not_found");
      const existing = creating ? null : await tx.journalEntry.findFirst({where: {id: input.id, userId}, include: {images: true}});
      if (!creating && !existing) throw new Error("not_found");
      if (existing && existing.version !== input.version) throw new Error("conflict");
      const removeIds = new Set(input.removeImageIds);
      if (removeIds.size && (!existing || [...removeIds].some((id) => !existing.images.some((image) => image.id === id)))) throw new Error("invalid_fields");
      const toRemove = existing?.images.filter((image) => removeIds.has(image.id)) ?? [];
      const [entryCount, aggregate] = await Promise.all([
        tx.journalEntry.count({where: {userId}}),
        tx.journalImage.aggregate({where: {userId}, _sum: {sizeBytes: true}})
      ]);
      imageCount = (existing?.images.length ?? 0) - toRemove.length + prepared.length;
      const bytes = (aggregate._sum.sizeBytes ?? 0) - toRemove.reduce((sum, image) => sum + image.sizeBytes, 0) + prepared.reduce((sum, image) => sum + image.sizeBytes, 0);
      if (imageCount > JOURNAL_MAX_IMAGES) throw new Error("image_count");
      if (!journalQuotaAllows({entryCount, creating, imageCount, bytes})) throw new Error("quota");
      if (existing) {
        const updated = await tx.journalEntry.updateMany({where: {id: existing.id, userId, version: input.version}, data: {title: input.title, body: input.body, occurredAt, version: {increment: 1}}});
        if (updated.count !== 1) throw new Error("conflict");
        entryId = existing.id;
        if (toRemove.length) await tx.journalImage.deleteMany({where: {entryId, userId, id: {in: toRemove.map((image) => image.id)}}});
      } else {
        const entry = await tx.journalEntry.create({data: {userId, title: input.title, body: input.body, occurredAt}});
        entryId = entry.id;
      }
      if (prepared.length) await tx.journalImage.createMany({data: prepared.map((image) => ({...image, entryId, userId}))});
      removed = toRemove.map((image) => image.storageKey);
    }, {timeout: 15000});
  } catch (error) {
    await cleanImages(written, userId);
    return {error: errorCode(error)};
  }
  await cleanImages(removed, userId);
  await writeAuditLog({actorUserId: userId, action: creating ? "JOURNAL_ENTRY_CREATE" : "JOURNAL_ENTRY_UPDATE", targetType: "JournalEntry", targetId: entryId, summary: "A private pilot journal entry was saved.", metadata: {imageCount}});
  revalidatePath(`/${locale}/journal`);
  redirect(`/${locale}/journal?saved=1`);
}

export async function deleteJournalEntryAction(formData: FormData) {
  const session = await auth();
  const locale = localeOf(formData);
  if (!session?.user?.id) redirect(`/${locale}/login`);
  const userId = session.user.id;
  const parsed = z.object({id: idSchema, version: z.coerce.number().int().positive()}).safeParse({id: formData.get("id"), version: formData.get("version")});
  if (!parsed.success || formData.get("confirmDelete") !== "yes") failure(locale, new Error("invalid_fields"));
  let removed: string[] = [];
  try {
    if (!mutationLimiter.consume(userId).allowed) throw new Error("rate_limit");
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const entry = await tx.journalEntry.findFirst({where: {id: parsed.data.id, userId}, include: {images: {select: {storageKey: true}}}});
      if (!entry) throw new Error("not_found");
      if (entry.version !== parsed.data.version) throw new Error("conflict");
      const deleted = await tx.journalEntry.deleteMany({where: {id: entry.id, userId, version: parsed.data.version}});
      if (deleted.count !== 1) throw new Error("conflict");
      removed = entry.images.map((image) => image.storageKey);
    });
  } catch (error) { failure(locale, error); }
  await cleanImages(removed, userId);
  await writeAuditLog({actorUserId: userId, action: "JOURNAL_ENTRY_DELETE", targetType: "JournalEntry", targetId: parsed.data.id, summary: "A private pilot journal entry was deleted.", metadata: {imageCount: removed.length}});
  revalidatePath(`/${locale}/journal`);
  redirect(`/${locale}/journal?deleted=1`);
}
