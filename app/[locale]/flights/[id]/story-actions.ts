"use server";

import fs from "node:fs/promises";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {sha256Buffer} from "@/lib/security";
import {detectStoryImageType, getStoryImageLimits} from "@/lib/flight-story";
import {writeAuditLog} from "@/lib/audit";

function safeLocale(value: FormDataEntryValue | null): "de" | "en" {
  return value === "en" ? "en" : "de";
}

function uploadRoot() {
  return (process.env.UPLOAD_DIR ?? "uploads").replace(/[\\/]+$/, "");
}

function refresh(locale: string, flightId: string) {
  revalidatePath(`/${locale}/flights/${flightId}`);
  revalidatePath(`/${locale}/flights/${flightId}/edit`);
}

export async function updateFlightStoryAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated.");
  const locale = safeLocale(formData.get("locale"));
  const flightId = String(formData.get("flightId") ?? "");
  const storyText = String(formData.get("storyText") ?? "").trim().slice(0, 5000) || null;
  const files = formData.getAll("storyImages").filter((item): item is File => item instanceof File && item.size > 0);
  const limits = getStoryImageLimits();
  const flight = await prisma.flight.findUnique({
    where: {id: flightId},
    select: {id: true, userId: true, deletedAt: true, moderationStatus: true, _count: {select: {storyImages: true}}, storyImages: {select: {sha256: true}}}
  });
  if (!flight || flight.deletedAt || flight.moderationStatus !== "APPROVED") throw new Error("Flight cannot be edited.");
  if (flight.userId !== session.user.id && !hasRole(session.user.roles, "ADMIN")) throw new Error("Not authorized.");
  if (flight._count.storyImages + files.length > limits.maxImagesPerFlight) redirect(`/${locale}/flights/${flightId}?storyError=count`);

  const existingHashes = new Set(flight.storyImages.map((image) => image.sha256));
  const prepared: Array<{objectPath: string; fileName: string; mimeType: string; sizeBytes: number; sha256: string; buffer: Buffer}> = [];
  for (const file of files) {
    if (file.size > limits.maxFileBytes) redirect(`/${locale}/flights/${flightId}?storyError=size`);
    const buffer = Buffer.from(await file.arrayBuffer());
    const detected = detectStoryImageType(buffer);
    if (!detected) redirect(`/${locale}/flights/${flightId}?storyError=type`);
    const sha256 = sha256Buffer(buffer);
    if (existingHashes.has(sha256)) continue;
    existingHashes.add(sha256);
    const directory = `${uploadRoot()}/stories/${flightId}`;
    prepared.push({
      objectPath: `${directory}/${sha256}.${detected.extension}`,
      fileName: file.name.trim().slice(0, 120) || `image.${detected.extension}`,
      mimeType: detected.mimeType,
      sizeBytes: buffer.length,
      sha256,
      buffer
    });
  }

  const written: string[] = [];
  try {
    for (const image of prepared) {
      await fs.mkdir(image.objectPath.slice(0, image.objectPath.lastIndexOf("/")), {recursive: true});
      await fs.writeFile(image.objectPath, image.buffer, {flag: "wx"}).then(() => written.push(image.objectPath)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "EEXIST") throw error;
      });
    }
    await prisma.flight.update({
      where: {id: flightId},
      data: {
        storyText,
        storyImages: {createMany: {data: prepared.map(({buffer: _buffer, ...image}) => ({...image, uploadedByUserId: session.user.id})), skipDuplicates: true}}
      }
    });
  } catch (error) {
    await Promise.allSettled(written.map((path) => fs.unlink(path)));
    throw error;
  }

  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "FLIGHT_STORY_UPDATE",
    targetType: "Flight",
    targetId: flightId,
    summary: "Flight story text or images were updated.",
    metadata: {uploadedImageCount: prepared.length, hasStoryText: storyText !== null}
  });
  refresh(locale, flightId);
  redirect(`/${locale}/flights/${flightId}?storyUpdated=1`);
}

export async function deleteFlightStoryImageAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated.");
  const locale = safeLocale(formData.get("locale"));
  const flightId = String(formData.get("flightId") ?? "");
  const imageId = String(formData.get("imageId") ?? "");
  const image = await prisma.flightStoryImage.findUnique({where: {id: imageId}, include: {flight: {select: {userId: true}}}});
  if (!image || image.flightId !== flightId) throw new Error("Image not found.");
  if (image.flight.userId !== session.user.id && !hasRole(session.user.roles, "MODERATOR")) throw new Error("Not authorized.");
  await prisma.flightStoryImage.delete({where: {id: image.id}});
  await fs.unlink(image.objectPath).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "FLIGHT_STORY_IMAGE_DELETE",
    targetType: "FlightStoryImage",
    targetId: image.id,
    summary: "A flight story image was removed.",
    metadata: {flightId, fileName: image.fileName}
  });
  refresh(locale, flightId);
  redirect(`/${locale}/flights/${flightId}?storyUpdated=1`);
}
