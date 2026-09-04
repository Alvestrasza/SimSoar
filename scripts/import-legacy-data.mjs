#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import {constants as fsConstants} from "node:fs";
import {PrismaClient} from "@prisma/client";
import {z} from "zod";
import {parseIgc} from "../lib/igc.ts";
import {safeFilename, sha256Buffer} from "../lib/security.ts";
import {decideLegacyImport, LEGACY_IMPORT_VERSION, OVERWRITE_CONFIRMATION, requireOverwriteConfirmation, resolveLegacySourcePath, summarizeLegacyImport} from "../lib/legacy-import.ts";

const flightSchema = z.object({
  sourceId: z.string().min(1).max(200),
  igcPath: z.string().min(1).max(500),
  targetUserId: z.string().min(1).optional(),
  targetUserEmail: z.string().email().optional(),
  pilotCallsign: z.string().min(2).max(40),
  simulator: z.string().min(2).max(40).optional(),
  title: z.string().min(1).max(200).optional(),
  registration: z.string().max(40).optional(),
  glider: z.string().max(80).optional(),
  competitionClass: z.string().max(80).optional(),
  comment: z.string().max(2000).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]).optional(),
  createdAt: z.string().datetime({offset: true}).optional()
}).refine((value) => Boolean(value.targetUserId) !== Boolean(value.targetUserEmail), {message: "Provide exactly one targetUserId or targetUserEmail."});

const manifestSchema = z.object({
  version: z.literal(LEGACY_IMPORT_VERSION),
  defaults: z.object({simulator: z.string().min(2).max(40), visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]).default("PRIVATE")}),
  flights: z.array(flightSchema).max(10000)
});

function usage() {
  return `Usage: node --experimental-strip-types scripts/import-legacy-data.mjs --manifest <file> --source-dir <directory> [--apply] [--report <file>] [--overwrite --confirm-overwrite=${OVERWRITE_CONFIRMATION}]\n\nDry-run is the default. Target users must already exist in SimSoar.`;
}

function parseArguments(values) {
  const options = {apply: false, overwrite: false};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--help" || value === "-h") options.help = true;
    else if (value === "--apply") options.apply = true;
    else if (value === "--overwrite") options.overwrite = true;
    else if (value === "--manifest") options.manifest = values[++index];
    else if (value === "--source-dir") options.sourceDir = values[++index];
    else if (value === "--report") options.report = values[++index];
    else if (value.startsWith("--confirm-overwrite=")) options.confirmOverwrite = value.slice(value.indexOf("=") + 1);
    else throw new Error(`Unknown argument: ${value}`);
  }
  return options;
}

function derivedRelations(parsed) {
  const stride = Math.max(1, Math.floor(parsed.points.length / 2500));
  return {
    track: {createMany: {data: parsed.points.filter((_, index) => index % stride === 0).map((point) => ({seq: point.seq, time: point.time, lat: point.lat, lon: point.lon, altM: point.altM, varioMs: point.varioMs}))}},
    thermals: {createMany: {data: parsed.thermals.map((thermal) => ({seq: thermal.seq, startSeq: thermal.startSeq, endSeq: thermal.endSeq, startTime: thermal.startTime, endTime: thermal.endTime, centerLat: thermal.centerLat, centerLon: thermal.centerLon, avgClimbMs: thermal.avgClimbMs, maxClimbMs: thermal.maxClimbMs, gainM: thermal.gainM, durationSec: thermal.durationSec, efficiencyPercent: thermal.efficiencyPercent, windDirectionDeg: thermal.windDirectionDeg, windSpeedKmh: thermal.windSpeedKmh, windConfidence: thermal.windConfidence, windDriftDistanceM: thermal.windDriftDistanceM}))}},
    glidePhases: {createMany: {data: parsed.glidePhases.map((phase) => ({seq: phase.seq, startSeq: phase.startSeq, endSeq: phase.endSeq, startTime: phase.startTime, endTime: phase.endTime, durationSec: phase.durationSec, distanceKm: phase.distanceKm, avgSpeedKmh: phase.avgSpeedKmh, avgSinkMs: phase.avgSinkMs, glideRatio: phase.glideRatio}))}},
    scoringPoints: {createMany: {data: parsed.scoring.points.map((point) => ({order: point.order, trackSeq: point.seq, lat: point.lat, lon: point.lon, legDistanceKm: point.legDistanceKm}))}}
  };
}

function flightData(entry, defaults, parsed, userId, objectPath, sha) {
  return {
    userId,
    pilotCallsign: entry.pilotCallsign,
    title: entry.title ?? `${entry.pilotCallsign} · ${Math.round(parsed.distanceKm)} km`,
    simulator: entry.simulator ?? defaults.simulator,
    glider: entry.glider ?? parsed.glider,
    registration: entry.registration ?? parsed.registration,
    competitionClass: entry.competitionClass,
    comment: entry.comment,
    visibility: entry.visibility ?? defaults.visibility,
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
    createdAt: entry.createdAt ? new Date(entry.createdAt) : undefined,
    ...derivedRelations(parsed)
  };
}

async function resolveUser(prisma, entry) {
  if (entry.targetUserId) return prisma.user.findUnique({where: {id: entry.targetUserId}, select: {id: true}});
  return prisma.user.findFirst({where: {email: {equals: entry.targetUserEmail, mode: "insensitive"}}, select: {id: true}});
}

async function writeReport(report, outputPath) {
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (outputPath) await fs.writeFile(path.resolve(outputPath), json, {flag: "wx", mode: 0o600});
  process.stdout.write(json);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) { console.log(usage()); return; }
  if (!options.manifest || !options.sourceDir) throw new Error("--manifest and --source-dir are required.\n\n" + usage());
  requireOverwriteConfirmation(options.overwrite, options.confirmOverwrite);
  const manifest = manifestSchema.parse(JSON.parse(await fs.readFile(path.resolve(options.manifest), "utf8")));
  const sourceIds = new Set();
  for (const entry of manifest.flights) {
    if (sourceIds.has(entry.sourceId)) throw new Error(`Duplicate sourceId in manifest: ${entry.sourceId}`);
    sourceIds.add(entry.sourceId);
  }

  if (manifest.flights.length === 0) {
    const items = [];
    await writeReport({format: "simsoar-legacy-import-report", version: LEGACY_IMPORT_VERSION, mode: options.apply ? "apply" : "dry-run", overwrite: options.overwrite, generatedAt: new Date().toISOString(), summary: summarizeLegacyImport(items), items}, options.report);
    return;
  }

  const prisma = new PrismaClient();
  const items = [];
  const uploadRoot = (process.env.UPLOAD_DIR ?? "uploads").replace(/[\\/]+$/, "");
  const maxBytes = Number(process.env.MAX_IGC_UPLOAD_BYTES ?? 10 * 1024 * 1024);
  try {
    for (const entry of manifest.flights) {
      try {
        const sourcePath = resolveLegacySourcePath(options.sourceDir, entry.igcPath);
        const buffer = await fs.readFile(sourcePath);
        if (buffer.length < 1 || buffer.length > maxBytes || buffer.includes(0)) throw new Error("IGC file size or content is invalid.");
        const sha = sha256Buffer(buffer);
        const [user, existing, blocked] = await Promise.all([
          resolveUser(prisma, entry),
          prisma.flight.findUnique({where: {igcSha256: sha}, select: {id: true, igcObjectPath: true}}),
          prisma.igcUploadBlock.findUnique({where: {igcSha256: sha}, select: {id: true}})
        ]);
        if (!user) throw new Error("Target user does not exist.");
        const decision = decideLegacyImport({existing: Boolean(existing), blocked: Boolean(blocked), overwrite: options.overwrite});
        if (decision === "REJECT_BLOCKED") { items.push({sourceId: entry.sourceId, status: "BLOCKED", igcSha256: sha}); continue; }
        if (decision === "SKIP_DUPLICATE") { items.push({sourceId: entry.sourceId, status: "SKIPPED_DUPLICATE", igcSha256: sha, flightId: existing.id}); continue; }
        const parsed = parseIgc(buffer.toString("utf8"));
        if (!options.apply) { items.push({sourceId: entry.sourceId, status: decision === "REPLACE" ? "WOULD_REPLACE" : "WOULD_IMPORT", igcSha256: sha, flightId: existing?.id}); continue; }

        const objectPath = existing?.igcObjectPath ?? [uploadRoot, sha.slice(0, 2), sha.slice(2, 4), `${sha}-${safeFilename(path.basename(entry.igcPath))}`].join("/");
        let copied = false;
        if (!existing) {
          await fs.mkdir(path.dirname(objectPath), {recursive: true});
          await fs.copyFile(sourcePath, objectPath, fsConstants.COPYFILE_EXCL);
          await fs.chmod(objectPath, 0o640);
          copied = true;
        }
        try {
          const data = flightData(entry, manifest.defaults, parsed, user.id, objectPath, sha);
          let flight;
          if (existing) {
            flight = await prisma.flight.update({where: {id: existing.id}, data: {...data, track: {deleteMany: {}, ...data.track}, thermals: {deleteMany: {}, ...data.thermals}, glidePhases: {deleteMany: {}, ...data.glidePhases}, scoringPoints: {deleteMany: {}, ...data.scoringPoints}}});
          } else flight = await prisma.flight.create({data});
          items.push({sourceId: entry.sourceId, status: existing ? "REPLACED" : "IMPORTED", igcSha256: sha, flightId: flight.id});
        } catch (error) {
          if (copied) await fs.unlink(objectPath).catch(() => undefined);
          throw error;
        }
      } catch (error) {
        items.push({sourceId: entry.sourceId, status: "FAILED", error: error instanceof Error ? error.message : "Unknown import error."});
      }
    }
  } finally {
    await prisma.$disconnect();
  }
  const report = {format: "simsoar-legacy-import-report", version: LEGACY_IMPORT_VERSION, mode: options.apply ? "apply" : "dry-run", overwrite: options.overwrite, generatedAt: new Date().toISOString(), summary: summarizeLegacyImport(items), items};
  await writeReport(report, options.report);
  if (report.summary.failures > 0) process.exitCode = 2;
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
