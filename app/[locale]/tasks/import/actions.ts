"use server";

import crypto from "node:crypto";
import {redirect} from "next/navigation";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {writeAuditLog} from "@/lib/audit";
import {CupParseError, parseCup} from "@/lib/cup";
import {safeFilename} from "@/lib/security";
import {normalizeTaskPoints, taskDistanceKm} from "@/lib/task-planner";

const MAX_CUP_BYTES = 10 * 1024 * 1024;

function decodeCup(buffer: Buffer) {
  try { return new TextDecoder("utf-8", {fatal: true}).decode(buffer); }
  catch { return new TextDecoder("windows-1252").decode(buffer); }
}

export async function importCupAction(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "de";
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authorized.");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_CUP_BYTES) redirect(`/${locale}/tasks/import?error=invalid-size`);
  if (!file.name.toLowerCase().endsWith(".cup")) redirect(`/${locale}/tasks/import?error=invalid-extension`);
  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const duplicate = await prisma.cupImport.findUnique({where: {ownerId_sha256: {ownerId: session.user.id, sha256}}, select: {id: true}});
  if (duplicate) redirect(`/${locale}/tasks/import?error=duplicate`);

  let parsed;
  try { parsed = parseCup(decodeCup(buffer)); }
  catch (error) {
    if (error instanceof CupParseError) redirect(`/${locale}/tasks/import?error=${encodeURIComponent(error.code)}${error.line ? `&line=${error.line}` : ""}`);
    throw error;
  }

  const sourceName = safeFilename(file.name).slice(0, 120);
  const result = await prisma.$transaction(async (tx) => {
    const cupImport = await tx.cupImport.create({data: {
      ownerId: session.user.id,
      sourceName,
      sha256,
      waypoints: {createMany: {data: parsed.waypoints.map((waypoint, seq) => ({
        seq,
        name: waypoint.name,
        code: waypoint.code,
        country: waypoint.country,
        lat: waypoint.lat,
        lon: waypoint.lon,
        elevationM: waypoint.elevationM,
        style: waypoint.style,
        description: waypoint.description
      }))}}
    }});
    for (const importedTask of parsed.tasks) {
      const points = normalizeTaskPoints(importedTask.points);
      await tx.flightTask.create({data: {
        ownerId: session.user.id,
        name: importedTask.name,
        description: `Imported from ${sourceName}`,
        visibility: "PRIVATE",
        totalDistanceKm: taskDistanceKm(points),
        waypoints: {createMany: {data: points}}
      }});
    }
    return cupImport;
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "CUP_IMPORT",
    targetType: "CupImport",
    targetId: result.id,
    summary: "A CUP waypoint file was imported.",
    metadata: {sourceName, waypointCount: parsed.waypoints.length, taskCount: parsed.tasks.length}
  });
  redirect(`/${locale}/tasks?imported=${parsed.waypoints.length}&tasks=${parsed.tasks.length}`);
}
