import "server-only";
import fs from "node:fs/promises";
import {Prisma} from "@prisma/client";
import {prisma} from "./db";
import {parseIgc} from "./igc";
import {safeFilename, sha256Buffer} from "./security";
import {COMPANION_MAX_IGC_BYTES, CompanionUploadPolicyError} from "./companion-upload-policy";
import {notifyFollowersAboutFlight} from "./notifications";
import {recalculateUserBadges} from "./badges";
import {recalculateFlightCompetitions} from "./competitions";
import {recalculateFlightLeagueEntries} from "./leagues";
import {recalculateFlightSegments} from "./segments";

export type CompanionFlightFields = {simulator: string; visibility: "PUBLIC" | "UNLISTED" | "PRIVATE"; registration: string | null; glider: string | null; competitionClass: string | null; comment: string | null};

function validIgcStructure(text: string) { return text.split(/\r?\n/).filter((line) => /^B\d{6}\d{7}[NS]\d{8}[EW][AV]\d{5}\d{5}/i.test(line)).length >= 2; }
function uniqueError(error: unknown) { return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"; }

export async function importCompanionFlight(input: {buffer: Buffer; fileName: string; mimeType: string; userId: string; pilotCallsign: string; fields: CompanionFlightFields}) {
  if (input.buffer.length <= 0 || input.buffer.length > COMPANION_MAX_IGC_BYTES) throw new CompanionUploadPolicyError("invalid_size");
  if (!input.fileName.toLowerCase().endsWith(".igc")) throw new CompanionUploadPolicyError("invalid_extension");
  if (!["", "text/plain", "application/octet-stream", "application/x-igc"].includes(input.mimeType.toLowerCase())) throw new CompanionUploadPolicyError("invalid_mime");
  if (input.buffer.includes(0)) throw new CompanionUploadPolicyError("invalid_content");
  const text = input.buffer.toString("utf8");
  if (!validIgcStructure(text)) throw new CompanionUploadPolicyError("invalid_content");
  const sha256 = sha256Buffer(input.buffer);
  const [duplicate, blocked] = await Promise.all([prisma.flight.findUnique({where: {igcSha256: sha256}, select: {id: true}}), prisma.igcUploadBlock.findUnique({where: {igcSha256: sha256}, select: {id: true}})]);
  if (duplicate || blocked) throw new CompanionUploadPolicyError("duplicate");
  let parsed: ReturnType<typeof parseIgc>;
  try { parsed = parseIgc(text); } catch { throw new CompanionUploadPolicyError("invalid_content"); }
  const uploadRoot = (process.env.UPLOAD_DIR ?? "uploads").replace(/[\\/]+$/, "");
  const uploadDir = [uploadRoot, sha256.slice(0, 2), sha256.slice(2, 4)].join("/");
  const objectPath = [uploadDir, `${sha256}-${safeFilename(input.fileName)}`].join("/");
  await fs.mkdir(/* turbopackIgnore: true */ uploadDir, {recursive: true});
  try { await fs.writeFile(/* turbopackIgnore: true */ objectPath, input.buffer, {flag: "wx", mode: 0o640}); } catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new CompanionUploadPolicyError("duplicate"); throw error; }
  try {
    const flight = await prisma.flight.create({data: {
      userId: input.userId, pilotCallsign: input.pilotCallsign, title: `${input.pilotCallsign} · ${Math.round(parsed.distanceKm)} km`, simulator: input.fields.simulator,
      glider: input.fields.glider || parsed.glider, registration: input.fields.registration || parsed.registration, competitionClass: input.fields.competitionClass,
      comment: input.fields.comment, visibility: input.fields.visibility, igcObjectPath: objectPath, igcSha256: sha256, startTime: parsed.startTime,
      durationSeconds: parsed.durationSeconds, distanceKm: parsed.distanceKm, olcPoints: parsed.olcPoints, scoringRule: parsed.scoring.ruleId,
      scoringDistanceKm: parsed.scoring.distanceKm, scoringMultiplier: parsed.scoring.multiplier, scoringClosedCourse: parsed.scoring.isClosedCourse,
      suggestedScoringStartSeq: parsed.scoringWindow.startSeq, suggestedScoringEndSeq: parsed.scoringWindow.endSeq, scoringStartSeq: parsed.scoringWindow.startSeq,
      scoringEndSeq: parsed.scoringWindow.endSeq, scoringWindowMode: "AUTO", scoringWindowReasons: parsed.scoringWindow.reasons,
      avgSpeedKmh: parsed.avgSpeedKmh, maxAltitudeM: parsed.maxAltitudeM, minAltitudeM: parsed.minAltitudeM, maxVarioMs: parsed.maxVarioMs,
      startLat: parsed.points[0]?.lat, startLon: parsed.points[0]?.lon, finishLat: parsed.points.at(-1)?.lat, finishLon: parsed.points.at(-1)?.lon,
      track: {createMany: {data: parsed.points.filter((_, index) => index % Math.max(1, Math.floor(parsed.points.length / 2500)) === 0).map((point) => ({seq: point.seq, time: point.time, lat: point.lat, lon: point.lon, altM: point.altM, varioMs: point.varioMs}))}},
      thermals: {createMany: {data: parsed.thermals.map((thermal) => ({seq: thermal.seq, startSeq: thermal.startSeq, endSeq: thermal.endSeq, startTime: thermal.startTime, endTime: thermal.endTime, centerLat: thermal.centerLat, centerLon: thermal.centerLon, avgClimbMs: thermal.avgClimbMs, maxClimbMs: thermal.maxClimbMs, gainM: thermal.gainM, durationSec: thermal.durationSec, efficiencyPercent: thermal.efficiencyPercent, windDirectionDeg: thermal.windDirectionDeg, windSpeedKmh: thermal.windSpeedKmh, windConfidence: thermal.windConfidence, windDriftDistanceM: thermal.windDriftDistanceM}))}},
      glidePhases: {createMany: {data: parsed.glidePhases.map((phase) => ({seq: phase.seq, startSeq: phase.startSeq, endSeq: phase.endSeq, startTime: phase.startTime, endTime: phase.endTime, durationSec: phase.durationSec, distanceKm: phase.distanceKm, avgSpeedKmh: phase.avgSpeedKmh, avgSinkMs: phase.avgSinkMs, glideRatio: phase.glideRatio}))}},
      scoringPoints: {createMany: {data: parsed.scoring.points.map((point) => ({order: point.order, trackSeq: point.seq, lat: point.lat, lon: point.lon, legDistanceKm: point.legDistanceKm}))}}
    }});
    await Promise.allSettled([notifyFollowersAboutFlight({pilotUserId: input.userId, flightId: flight.id, isPublicAndApproved: input.fields.visibility === "PUBLIC"}), recalculateUserBadges(input.userId), recalculateFlightCompetitions(flight.id), recalculateFlightLeagueEntries(flight.id), recalculateFlightSegments(flight.id)]);
    return {flight, sha256};
  } catch (error) {
    await fs.unlink(/* turbopackIgnore: true */ objectPath).catch(() => undefined);
    if (uniqueError(error)) throw new CompanionUploadPolicyError("duplicate");
    throw error;
  }
}
