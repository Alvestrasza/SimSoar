"use server";

import fs from "node:fs/promises";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {Prisma} from "@prisma/client";
import {z} from "zod";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {writeAuditLog} from "@/lib/audit";
import {recalculateUserBadges} from "@/lib/badges";
import {recalculateFlightCompetitions} from "@/lib/competitions";
import {parseIgc} from "@/lib/igc";
import {safeFilename, sha256Buffer} from "@/lib/security";

const editFlightSchema = z.object({
  locale: z.enum(["de", "en"]).default("de"),
  flightId: z.string().min(1),
  title: z.string().trim().min(3).max(160),
  simulator: z.string().trim().min(2).max(40),
  glider: z.string().trim().max(80).optional(),
  registration: z.string().trim().max(40).optional(),
  competitionClass: z.string().trim().max(80).optional(),
  weatherMode: z.enum(["UNKNOWN", "LIVE", "PRESET", "CUSTOM"]).default("UNKNOWN"),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]),
  publicIgcDownloadEnabled: z.boolean().default(false),
  comment: z.string().trim().max(2000).optional()
});

const allowedIgcMimeTypes = new Set([
  "",
  "text/plain",
  "application/octet-stream",
  "application/x-igc"
]);

type ReplaceErrorCode =
  | "invalid-size"
  | "invalid-extension"
  | "invalid-mime"
  | "invalid-content"
  | "duplicate"
  | "deleted-flight"
  | "write-failed";

type PreparedIgcReplacement = {
  buffer: Buffer;
  text: string;
  sha: string;
  objectPath: string;
  parsed: ReturnType<typeof parseIgc>;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
};

function revalidateFlightViews(locale: "de" | "en", flightId: string) {
  revalidatePath("/");
  revalidatePath("/de");
  revalidatePath("/en");
  revalidatePath("/de/flights");
  revalidatePath("/en/flights");
  revalidatePath("/de/pilots");
  revalidatePath("/en/pilots");
  revalidatePath("/de/profile");
  revalidatePath("/en/profile");
  revalidatePath("/de/admin");
  revalidatePath("/en/admin");
  revalidatePath("/de/admin/flights");
  revalidatePath("/en/admin/flights");
  revalidatePath(`/${locale}/flights/${flightId}`);
  revalidatePath(`/${locale}/flights/${flightId}/edit`);
}

function redirectReplaceError(
  locale: "de" | "en",
  flightId: string,
  code: ReplaceErrorCode
): never {
  redirect(`/${locale}/flights/${flightId}/edit?replaceError=${code}`);
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

function getOptionalIgcFile(formData: FormData): File | null {
  const file = formData.get("igc");

  if (!(file instanceof File)) {
    return null;
  }

  if (file.size <= 0) {
    return null;
  }

  return file;
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

async function cleanupUploadedFile(objectPath: string | null | undefined) {
  if (!objectPath) {
    return;
  }

  try {
    await fs.unlink(/* turbopackIgnore: true */ objectPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code !== "ENOENT") {
      console.warn("SimSoar IGC replacement cleanup failed:", {
        objectPath,
        error
      });
    }
  }
}

async function writeReplacementFile(
  file: File,
  locale: "de" | "en",
  flightId: string
): Promise<PreparedIgcReplacement> {
  const maxBytes = Number(process.env.MAX_IGC_UPLOAD_BYTES ?? 10 * 1024 * 1024);

  if (file.size <= 0 || file.size > maxBytes) {
    redirectReplaceError(locale, flightId, "invalid-size");
  }

  if (!file.name.toLowerCase().endsWith(".igc")) {
    redirectReplaceError(locale, flightId, "invalid-extension");
  }

  const mimeType = file.type.toLowerCase();

  if (!allowedIgcMimeTypes.has(mimeType)) {
    redirectReplaceError(locale, flightId, "invalid-mime");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (hasNullBytes(buffer)) {
    redirectReplaceError(locale, flightId, "invalid-content");
  }

  const text = buffer.toString("utf8");

  if (!hasValidIgcStructure(text)) {
    redirectReplaceError(locale, flightId, "invalid-content");
  }

  let parsed: ReturnType<typeof parseIgc>;

  try {
    parsed = parseIgc(text);
  } catch (error) {
    console.warn("SimSoar IGC replacement rejected during parser validation:", {
      flightId,
      fileName: file.name,
      mimeType,
      size: file.size,
      error
    });

    redirectReplaceError(locale, flightId, "invalid-content");
  }

  const sha = sha256Buffer(buffer);

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

  await fs.mkdir(/* turbopackIgnore: true */ uploadDir, {recursive: true});

  try {
    await fs.writeFile(
      /* turbopackIgnore: true */ objectPath,
      buffer,
      {
        flag: "wx",
        mode: 0o640
      }
    );
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === "EEXIST") {
      redirectReplaceError(locale, flightId, "duplicate");
    }

    console.error("SimSoar IGC replacement file write failed:", {
      objectPath,
      error
    });

    redirectReplaceError(locale, flightId, "write-failed");
  }

  return {
    buffer,
    text,
    sha,
    objectPath,
    parsed,
    originalFileName: file.name,
    mimeType,
    sizeBytes: file.size
  };
}

export async function updateFlightMetadataAction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated.");
  }

  const fields = editFlightSchema.parse({
    locale: formData.get("locale") || "de",
    flightId: formData.get("flightId"),
    title: formData.get("title"),
    simulator: formData.get("simulator"),
    glider: formData.get("glider") || undefined,
    registration: formData.get("registration") || undefined,
    competitionClass: formData.get("competitionClass") || undefined,
    weatherMode: formData.get("weatherMode") || "UNKNOWN",
    visibility: formData.get("visibility"),
    publicIgcDownloadEnabled: formData.get("publicIgcDownloadEnabled") === "on",
    comment: formData.get("comment") || undefined
  });

  const currentFlight = await prisma.flight.findUnique({
    where: {
      id: fields.flightId
    },
    select: {
      id: true,
      userId: true,
      title: true,
      pilotCallsign: true,
      simulator: true,
      glider: true,
      registration: true,
      competitionClass: true,
      weatherMode: true,
      visibility: true,
      publicIgcDownloadEnabled: true,
      comment: true,
      moderationStatus: true,
      deletedAt: true,
      igcObjectPath: true,
      igcSha256: true
    }
  });

  if (!currentFlight) {
    throw new Error("Flight not found.");
  }

  const isOwner = currentFlight.userId === session.user.id;
  const canAdminEdit = hasRole(session.user.roles, "ADMIN");

  const canOwnerEdit =
    isOwner &&
    currentFlight.deletedAt === null &&
    currentFlight.moderationStatus === "APPROVED";

  if (!canAdminEdit && !canOwnerEdit) {
    throw new Error("Not authorized to edit this flight.");
  }

  const igcFile = getOptionalIgcFile(formData);

  if (igcFile && currentFlight.deletedAt) {
    redirectReplaceError(fields.locale, currentFlight.id, "deleted-flight");
  }

  let replacement: PreparedIgcReplacement | null = null;

  if (igcFile) {
    const prepared = await writeReplacementFile(
      igcFile,
      fields.locale,
      currentFlight.id
    );

    if (prepared.sha !== currentFlight.igcSha256) {
      const [duplicateFlight, blockedUpload] = await Promise.all([
        prisma.flight.findFirst({
          where: {
            igcSha256: prepared.sha,
            NOT: {
              id: currentFlight.id
            }
          },
          select: {
            id: true
          }
        }),
        prisma.igcUploadBlock.findUnique({
          where: {
            igcSha256: prepared.sha
          },
          select: {
            id: true
          }
        })
      ]);

      if (duplicateFlight || blockedUpload) {
        await cleanupUploadedFile(prepared.objectPath);
        redirectReplaceError(fields.locale, currentFlight.id, "duplicate");
      }

      replacement = prepared;
    } else {
      await cleanupUploadedFile(prepared.objectPath);
    }
  }

  let updatedFlight;

  try {
    updatedFlight = await prisma.$transaction(async (tx) => {
      const updated = await tx.flight.update({
        where: {
          id: currentFlight.id
        },
        data: {
          title: fields.title,
          simulator: fields.simulator,
          glider: fields.glider,
          registration: fields.registration,
          competitionClass: fields.competitionClass,
          weatherMode: fields.weatherMode,
          visibility: fields.visibility,
          publicIgcDownloadEnabled: fields.publicIgcDownloadEnabled,
          comment: fields.comment,
          ...(replacement
            ? {
                igcObjectPath: replacement.objectPath,
                igcSha256: replacement.sha,
                startTime: replacement.parsed.startTime,
                durationSeconds: replacement.parsed.durationSeconds,
                distanceKm: replacement.parsed.distanceKm,
                olcPoints: replacement.parsed.olcPoints,
                scoringRule: replacement.parsed.scoring.ruleId,
                scoringDistanceKm: replacement.parsed.scoring.distanceKm,
                scoringMultiplier: replacement.parsed.scoring.multiplier,
                scoringClosedCourse: replacement.parsed.scoring.isClosedCourse,
                suggestedScoringStartSeq: replacement.parsed.scoringWindow.startSeq,
                suggestedScoringEndSeq: replacement.parsed.scoringWindow.endSeq,
                scoringStartSeq: replacement.parsed.scoringWindow.startSeq,
                scoringEndSeq: replacement.parsed.scoringWindow.endSeq,
                scoringWindowMode: "AUTO",
                scoringWindowReasons: replacement.parsed.scoringWindow.reasons,
                avgSpeedKmh: replacement.parsed.avgSpeedKmh,
                maxAltitudeM: replacement.parsed.maxAltitudeM,
                minAltitudeM: replacement.parsed.minAltitudeM,
                maxVarioMs: replacement.parsed.maxVarioMs,
                startLat: replacement.parsed.points[0]?.lat,
                startLon: replacement.parsed.points[0]?.lon,
                finishLat: replacement.parsed.points.at(-1)?.lat,
                finishLon: replacement.parsed.points.at(-1)?.lon
              }
            : {})
        },
        select: {
          id: true,
          title: true,
          pilotCallsign: true,
          simulator: true,
          glider: true,
          registration: true,
          competitionClass: true,
          weatherMode: true,
          visibility: true,
          publicIgcDownloadEnabled: true,
          comment: true,
          moderationStatus: true,
          igcObjectPath: true,
          igcSha256: true,
          distanceKm: true,
          olcPoints: true
        }
      });

      if (replacement) {
        await tx.trackPoint.deleteMany({
          where: {
            flightId: currentFlight.id
          }
        });

        await tx.thermal.deleteMany({
          where: {
            flightId: currentFlight.id
          }
        });

        await tx.glidePhase.deleteMany({
          where: {
            flightId: currentFlight.id
          }
        });

        await tx.flightScoringPoint.deleteMany({
          where: {
            flightId: currentFlight.id
          }
        });

        await tx.trackPoint.createMany({
          data: replacement.parsed.points
            .filter((_, i) =>
              i % Math.max(1, Math.floor(replacement.parsed.points.length / 2500)) === 0
            )
            .map((point) => ({
              flightId: currentFlight.id,
              seq: point.seq,
              time: point.time,
              lat: point.lat,
              lon: point.lon,
              altM: point.altM,
              varioMs: point.varioMs
            }))
        });

        await tx.thermal.createMany({
          data: replacement.parsed.thermals.map((thermal) => ({
            flightId: currentFlight.id,
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
        });

        await tx.glidePhase.createMany({
          data: replacement.parsed.glidePhases.map((phase) => ({
            flightId: currentFlight.id,
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
        });

        await tx.flightScoringPoint.createMany({
          data: replacement.parsed.scoring.points.map((point) => ({
            flightId: currentFlight.id,
            order: point.order,
            trackSeq: point.seq,
            lat: point.lat,
            lon: point.lon,
            legDistanceKm: point.legDistanceKm
          }))
        });
      }

      return updated;
    });
  } catch (error) {
    await cleanupUploadedFile(replacement?.objectPath);

    if (isUniqueConstraintError(error, "igcSha256")) {
      redirectReplaceError(fields.locale, currentFlight.id, "duplicate");
    }

    throw error;
  }

  if (replacement) {
    await cleanupUploadedFile(currentFlight.igcObjectPath);
  }

  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: replacement ? "FLIGHT_IGC_REPLACE" : "FLIGHT_UPDATE",
    targetType: "Flight",
    targetId: updatedFlight.id,
    summary: replacement
      ? "Flight metadata and IGC file were updated."
      : "Flight metadata was updated.",
    metadata: {
      previous: {
        title: currentFlight.title,
        simulator: currentFlight.simulator,
        glider: currentFlight.glider,
        registration: currentFlight.registration,
        competitionClass: currentFlight.competitionClass,
        weatherMode: currentFlight.weatherMode,
        visibility: currentFlight.visibility,
        publicIgcDownloadEnabled: currentFlight.publicIgcDownloadEnabled,
        comment: currentFlight.comment,
        igcSha256: currentFlight.igcSha256
      },
      current: {
        title: updatedFlight.title,
        simulator: updatedFlight.simulator,
        glider: updatedFlight.glider,
        registration: updatedFlight.registration,
        competitionClass: updatedFlight.competitionClass,
        weatherMode: updatedFlight.weatherMode,
        visibility: updatedFlight.visibility,
        publicIgcDownloadEnabled: updatedFlight.publicIgcDownloadEnabled,
        comment: updatedFlight.comment,
        igcSha256: updatedFlight.igcSha256
      },
      replacement: replacement
        ? {
            originalFileName: replacement.originalFileName,
            mimeType: replacement.mimeType,
            sizeBytes: replacement.sizeBytes,
            distanceKm: updatedFlight.distanceKm,
            olcPoints: updatedFlight.olcPoints
          }
        : null,
      pilotCallsign: updatedFlight.pilotCallsign,
      moderationStatus: updatedFlight.moderationStatus
    }
  });

  await recalculateUserBadges(session.user.id);
  await recalculateFlightCompetitions(updatedFlight.id);
  revalidateFlightViews(fields.locale, updatedFlight.id);

  redirect(`/${fields.locale}/flights/${updatedFlight.id}`);
}
