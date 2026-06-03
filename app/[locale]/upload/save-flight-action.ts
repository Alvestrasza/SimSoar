"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { parseIgc } from "@/lib/igc";
import { safeFilename, sha256Buffer } from "@/lib/security";
import { writeAuditLog } from "@/lib/audit";
import { hasRole } from "@/lib/rbac";
import { Prisma } from "@prisma/client";

const formSchema = z.object({
  locale: z.enum(["de", "en"]).default("de"),
  pilotCallsign: z.string().min(2).max(40),
  simulator: z.string().min(2).max(40),
  registration: z.string().max(40).optional(),
  glider: z.string().max(80).optional(),
  competitionClass: z.string().max(80).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]),
  comment: z.string().max(2000).optional()
});

const allowedIgcMimeTypes = new Set([
  "",
  "text/plain",
  "application/octet-stream",
  "application/x-igc"
]);

type UploadErrorCode =
  | "missing-file"
  | "invalid-size"
  | "invalid-extension"
  | "invalid-mime"
  | "invalid-content"
  | "duplicate";

function getLocale(formData: FormData): "de" | "en" {
  return formData.get("locale") === "en" ? "en" : "de";
}

function redirectUploadError(locale: "de" | "en", code: UploadErrorCode): never {
  redirect(`/${locale}/upload?uploadError=${code}`);
}

function hasNullBytes(buffer: Buffer): boolean {
  return buffer.includes(0);
}

function hasValidIgcStructure(text: string): boolean {
  const lines = text.split(/\r?\n/);

  const validBRecords = lines.filter((line) =>
    /^B\d{6}\d{7}[NS]\d{8}[EW][AV]\d{5}\d{5}/i.test(line)
  );

  return validBRecords.length >= 2;
}

function trimTrailingPathSeparators(value: string): string {
  return value.replace(/[\\/]+$/, "");
}

function isUniqueConstraintError(error: unknown, fieldName: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.includes(fieldName);
  }

  return target === fieldName;
}

async function cleanupUploadedFile(objectPath: string) {
  try {
    await fs.unlink(/* turbopackIgnore: true */ objectPath);
  } catch (error) {
    console.warn("SimSoar upload cleanup failed:", {
      objectPath,
      error
    });
  }
}

export async function saveFlightAction(formData: FormData) {
  const locale = getLocale(formData);

  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated.");
  }

  if (!hasRole(session.user.roles, "PILOT")) {
    throw new Error("Pilot role required to upload flights.");
  }

  const file = formData.get("igc");

  if (!(file instanceof File)) {
    redirectUploadError(locale, "missing-file");
  }

  const maxBytes = Number(process.env.MAX_IGC_UPLOAD_BYTES ?? 10 * 1024 * 1024);

  if (file.size <= 0 || file.size > maxBytes) {
    redirectUploadError(locale, "invalid-size");
  }

  if (!file.name.toLowerCase().endsWith(".igc")) {
    redirectUploadError(locale, "invalid-extension");
  }

  const mimeType = file.type.toLowerCase();

  if (!allowedIgcMimeTypes.has(mimeType)) {
    redirectUploadError(locale, "invalid-mime");
  }

  const fields = formSchema.parse({
    locale,
    pilotCallsign: formData.get("pilotCallsign"),
    simulator: formData.get("simulator"),
    registration: formData.get("registration") || undefined,
    glider: formData.get("glider") || undefined,
    competitionClass: formData.get("competitionClass") || undefined,
    visibility: formData.get("visibility"),
    comment: formData.get("comment") || undefined
  });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (hasNullBytes(buffer)) {
    redirectUploadError(locale, "invalid-content");
  }

  const text = buffer.toString("utf8");

  if (!hasValidIgcStructure(text)) {
    redirectUploadError(locale, "invalid-content");
  }

  const sha = sha256Buffer(buffer);

  const duplicateFlight = await prisma.flight.findFirst({
    where: {
      igcSha256: sha
    },
    select: {
      id: true
    }
  });

  if (duplicateFlight) {
    redirectUploadError(locale, "duplicate");
  }

  let parsed;

  try {
    parsed = parseIgc(text);
  } catch (error) {
    console.warn("SimSoar IGC upload rejected during parser validation:", {
      userId: session.user.id,
      fileName: file.name,
      mimeType,
      size: file.size,
      error
    });

    redirectUploadError(locale, "invalid-content");
  }

  const uploadRoot = trimTrailingPathSeparators(
    process.env.UPLOAD_DIR ?? "uploads"
  );

  const uploadDir = [
    uploadRoot,
    sha.slice(0, 2),
    sha.slice(2, 4)
  ].join("/");

  const objectPath = [
    uploadDir,
    `${sha}-${safeFilename(file.name)}`
  ].join("/");

  await fs.mkdir(/* turbopackIgnore: true */ uploadDir, { recursive: true });

  await fs.writeFile(
    /* turbopackIgnore: true */ objectPath,
    buffer,
    {
      flag: "wx",
      mode: 0o640
    }
  );

  let flight;

  try {
    flight = await prisma.flight.create({
      data: {
        userId: session.user.id,
        pilotCallsign: fields.pilotCallsign,
        title: `${fields.pilotCallsign} · ${Math.round(parsed.distanceKm)} km`,
        simulator: fields.simulator,
        glider: fields.glider || parsed.glider,
        registration: fields.registration || parsed.registration,
        competitionClass: fields.competitionClass,
        comment: fields.comment,
        visibility: fields.visibility,
        igcObjectPath: objectPath,
        igcSha256: sha,
        startTime: parsed.startTime,
        durationSeconds: parsed.durationSeconds,
        distanceKm: parsed.distanceKm,
        olcPoints: parsed.olcPoints,
        avgSpeedKmh: parsed.avgSpeedKmh,
        maxAltitudeM: parsed.maxAltitudeM,
        minAltitudeM: parsed.minAltitudeM,
        maxVarioMs: parsed.maxVarioMs,
        startLat: parsed.points[0]?.lat,
        startLon: parsed.points[0]?.lon,
        finishLat: parsed.points.at(-1)?.lat,
        finishLon: parsed.points.at(-1)?.lon,
        track: {
          createMany: {
            data: parsed.points
              .filter((_, i) => i % Math.max(1, Math.floor(parsed.points.length / 2500)) === 0)
              .map((p) => ({
                seq: p.seq,
                time: p.time,
                lat: p.lat,
                lon: p.lon,
                altM: p.altM,
                varioMs: p.varioMs
              }))
          }
        },
        thermals: {
          createMany: {
            data: parsed.thermals.map((t) => ({
              seq: t.seq,
              startTime: t.startTime,
              endTime: t.endTime,
              centerLat: t.centerLat,
              centerLon: t.centerLon,
              avgClimbMs: t.avgClimbMs,
              maxClimbMs: t.maxClimbMs,
              gainM: t.gainM,
              durationSec: t.durationSec
            }))
          }
        }
      }
    });
  } catch (error) {
    await cleanupUploadedFile(objectPath);

    if (isUniqueConstraintError(error, "igcSha256")) {
      redirectUploadError(locale, "duplicate");
    }

    throw error;
  }

  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "FLIGHT_UPLOAD",
    targetType: "Flight",
    targetId: flight.id,
    summary: "Flight uploaded and automatically approved.",
    metadata: {
      title: flight.title,
      visibility: fields.visibility,
      moderationStatus: "APPROVED",
      simulator: fields.simulator,
      distanceKm: parsed.distanceKm,
      olcPoints: parsed.olcPoints,
      igcSha256: sha,
      originalFileName: file.name,
      mimeType,
      sizeBytes: file.size,
      storagePath: objectPath
    }
  });

  redirect(`/${fields.locale}/flights/${flight.id}`);
}
