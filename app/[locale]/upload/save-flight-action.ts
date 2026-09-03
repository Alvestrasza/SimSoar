"use server";

import fs from "node:fs/promises";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { parseIgc } from "@/lib/igc";
import { safeFilename, sha256Buffer } from "@/lib/security";
import { writeAuditLog } from "@/lib/audit";
import { notifyFollowersAboutFlight } from "@/lib/notifications";
import { hasRole } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import {
  displayUploadFileName,
  getBulkUploadLimits,
  validateBatchLimits
} from "@/lib/bulk-upload-policy";

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
  | "duplicate"
  | "too-many-files"
  | "total-size"
  | "processing-failed";

class UploadFileError extends Error {
  constructor(readonly code: UploadErrorCode) {
    super(code);
  }
}

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

type UploadFields = z.infer<typeof formSchema>;

async function importFlightFile({
  file,
  fields,
  userId,
  userEmail,
  maxFileBytes
}: {
  file: File;
  fields: UploadFields;
  userId: string;
  userEmail?: string | null;
  maxFileBytes: number;
}) {
  if (file.size <= 0 || file.size > maxFileBytes) {
    throw new UploadFileError("invalid-size");
  }

  if (!file.name.toLowerCase().endsWith(".igc")) {
    throw new UploadFileError("invalid-extension");
  }

  const mimeType = file.type.toLowerCase();
  if (!allowedIgcMimeTypes.has(mimeType)) {
    throw new UploadFileError("invalid-mime");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (hasNullBytes(buffer)) {
    throw new UploadFileError("invalid-content");
  }

  const text = buffer.toString("utf8");
  if (!hasValidIgcStructure(text)) {
    throw new UploadFileError("invalid-content");
  }

  const sha = sha256Buffer(buffer);
  const [duplicateFlight, blockedUpload] = await Promise.all([
    prisma.flight.findFirst({where: {igcSha256: sha}, select: {id: true}}),
    prisma.igcUploadBlock.findUnique({where: {igcSha256: sha}, select: {id: true}})
  ]);

  if (duplicateFlight || blockedUpload) {
    throw new UploadFileError("duplicate");
  }

  let parsed;
  try {
    parsed = parseIgc(text);
  } catch (error) {
    console.warn("SimSoar IGC upload rejected during parser validation:", {
      userId,
      fileName: displayUploadFileName(file.name),
      mimeType,
      size: file.size,
      error
    });
    throw new UploadFileError("invalid-content");
  }

  const uploadRoot = trimTrailingPathSeparators(process.env.UPLOAD_DIR ?? "uploads");
  const uploadDir = [uploadRoot, sha.slice(0, 2), sha.slice(2, 4)].join("/");
  const objectPath = [uploadDir, `${sha}-${safeFilename(file.name)}`].join("/");

  await fs.mkdir(/* turbopackIgnore: true */ uploadDir, {recursive: true});
  try {
    await fs.writeFile(/* turbopackIgnore: true */ objectPath, buffer, {
      flag: "wx",
      mode: 0o640
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new UploadFileError("duplicate");
    }
    throw error;
  }

  let flight;
  try {
    flight = await prisma.flight.create({
      data: {
        userId,
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
        scoringRule: parsed.scoring.ruleId,
        scoringDistanceKm: parsed.scoring.distanceKm,
        scoringMultiplier: parsed.scoring.multiplier,
        scoringClosedCourse: parsed.scoring.isClosedCourse,
        suggestedScoringStartSeq: parsed.scoringWindow.startSeq,
        suggestedScoringEndSeq: parsed.scoringWindow.endSeq,
        scoringStartSeq: parsed.scoringWindow.startSeq,
        scoringEndSeq: parsed.scoringWindow.endSeq,
        scoringWindowMode: "AUTO",
        scoringWindowReasons: parsed.scoringWindow.reasons,
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
              .filter((_: unknown, index: number) => index % Math.max(1, Math.floor(parsed.points.length / 2500)) === 0)
              .map((point: (typeof parsed.points)[number]) => ({
                seq: point.seq,
                time: point.time,
                lat: point.lat,
                lon: point.lon,
                altM: point.altM,
                varioMs: point.varioMs
              }))
          }
        },
        thermals: {
          createMany: {
            data: parsed.thermals.map((thermal: (typeof parsed.thermals)[number]) => ({
              seq: thermal.seq,
              startSeq: thermal.startSeq,
              endSeq: thermal.endSeq,
              startTime: thermal.startTime,
              endTime: thermal.endTime,
              centerLat: thermal.centerLat,
              centerLon: thermal.centerLon,
              avgClimbMs: thermal.avgClimbMs,
              maxClimbMs: thermal.maxClimbMs,
              gainM: thermal.gainM,
              durationSec: thermal.durationSec,
              efficiencyPercent: thermal.efficiencyPercent,
              windDirectionDeg: thermal.windDirectionDeg,
              windSpeedKmh: thermal.windSpeedKmh,
              windConfidence: thermal.windConfidence,
              windDriftDistanceM: thermal.windDriftDistanceM
            }))
          }
        },
        glidePhases: {
          createMany: {
            data: parsed.glidePhases.map((phase: (typeof parsed.glidePhases)[number]) => ({
              seq: phase.seq,
              startSeq: phase.startSeq,
              endSeq: phase.endSeq,
              startTime: phase.startTime,
              endTime: phase.endTime,
              durationSec: phase.durationSec,
              distanceKm: phase.distanceKm,
              avgSpeedKmh: phase.avgSpeedKmh,
              avgSinkMs: phase.avgSinkMs,
              glideRatio: phase.glideRatio
            }))
          }
        },
        scoringPoints: {
          createMany: {
            data: parsed.scoring.points.map((point) => ({
              order: point.order,
              trackSeq: point.seq,
              lat: point.lat,
              lon: point.lon,
              legDistanceKm: point.legDistanceKm
            }))
          }
        }
      }
    });
  } catch (error) {
    await cleanupUploadedFile(objectPath);
    if (isUniqueConstraintError(error, "igcSha256")) {
      throw new UploadFileError("duplicate");
    }
    throw error;
  }

  const followUpResults = await Promise.allSettled([
    writeAuditLog({
      actorUserId: userId,
      actorEmail: userEmail,
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
        originalFileName: displayUploadFileName(file.name),
        mimeType,
        sizeBytes: file.size,
        storagePath: objectPath
      }
    }),
    notifyFollowersAboutFlight({
      pilotUserId: userId,
      flightId: flight.id,
      isPublicAndApproved: fields.visibility === "PUBLIC"
    })
  ]);

  if (followUpResults.some((result) => result.status === "rejected")) {
    console.error("SimSoar upload follow-up failed after a successful import.", {
      userId,
      flightId: flight.id
    });
  }

  return flight;
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

  const files = formData.getAll("igc").filter((entry): entry is File => entry instanceof File);
  const limits = getBulkUploadLimits();
  const batchLimitError = validateBatchLimits(files, limits);
  if (batchLimitError) {
    redirectUploadError(locale, batchLimitError);
  }

  const batch = await prisma.uploadBatch.create({data: {userId: session.user.id}});

  for (const file of files) {
    const originalFileName = displayUploadFileName(file.name);
    try {
      const flight = await importFlightFile({
        file,
        fields,
        userId: session.user.id,
        userEmail: session.user.email,
        maxFileBytes: limits.maxFileBytes
      });
      await prisma.uploadBatchItem.create({
        data: {batchId: batch.id, originalFileName, status: "IMPORTED", flightId: flight.id}
      });
    } catch (error) {
      const errorCode = error instanceof UploadFileError ? error.code : "processing-failed";
      console.error("SimSoar bulk upload item failed.", {
        userId: session.user.id,
        batchId: batch.id,
        originalFileName,
        errorCode,
        error: error instanceof UploadFileError ? undefined : error
      });
      await prisma.uploadBatchItem.create({
        data: {batchId: batch.id, originalFileName, status: "FAILED", errorCode}
      });
    }
  }

  redirect(`/${fields.locale}/upload/results/${batch.id}`);
}
