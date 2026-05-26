"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { parseIgc } from "@/lib/igc";
import { safeFilename, sha256Buffer } from "@/lib/security";

const formSchema = z.object({
  pilotCallsign: z.string().min(2).max(40),
  simulator: z.string().min(2).max(40),
  registration: z.string().max(40).optional(),
  glider: z.string().max(80).optional(),
  competitionClass: z.string().max(80).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]),
  comment: z.string().max(2000).optional()
});

export async function saveFlightAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated.");

  const file = formData.get("igc");
  if (!(file instanceof File)) throw new Error("Missing IGC file.");

  const maxBytes = Number(process.env.MAX_IGC_UPLOAD_BYTES ?? 10 * 1024 * 1024);
  if (file.size <= 0 || file.size > maxBytes) throw new Error("Invalid file size.");
  if (!file.name.toLowerCase().endsWith(".igc")) throw new Error("Only .igc files are allowed.");

  const fields = formSchema.parse({
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
  const sha = sha256Buffer(buffer);
  const text = buffer.toString("utf8");
  const parsed = parseIgc(text);

  const uploadRoot = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
  await fs.mkdir(uploadRoot, { recursive: true });
  const objectPath = path.join(uploadRoot, `${Date.now()}-${sha.slice(0, 12)}-${safeFilename(file.name)}`);
  await fs.writeFile(objectPath, buffer, { flag: "wx" });

  const flight = await prisma.flight.create({
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
            .map((p) => ({ seq: p.seq, time: p.time, lat: p.lat, lon: p.lon, altM: p.altM, varioMs: p.varioMs }))
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

  redirect(`/flights/${flight.id}`);
}
