"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {airspaceBounds, parseOpenAir, validateAirspaceImport} from "@/lib/airspace";
import {writeAuditLog} from "@/lib/audit";
import crypto from "node:crypto";

const MEBIBYTE = 1024 * 1024;
const DEFAULT_MAX_BYTES = 100 * MEBIBYTE;
const ABSOLUTE_MAX_BYTES = 250 * MEBIBYTE;
const DEFAULT_MAX_AIRSPACES = 50_000;
const ABSOLUTE_MAX_AIRSPACES = 200_000;
const DEFAULT_MAX_POINTS_PER_AIRSPACE = 50_000;
const ABSOLUTE_MAX_POINTS_PER_AIRSPACE = 250_000;
const DEFAULT_MAX_TOTAL_POINTS = 2_000_000;
const ABSOLUTE_MAX_TOTAL_POINTS = 10_000_000;
const AIRSPACE_BATCH_SIZE = 250;
const POINT_BATCH_SIZE = 5_000;

function configuredLimit(name: string, fallback: number, absoluteMaximum: number) {
  const configured = Number(process.env[name]);
  return Number.isFinite(configured) && configured > 0
    ? Math.min(Math.floor(configured), absoluteMaximum)
    : fallback;
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function safeLocale(value: FormDataEntryValue | null) {
  return value === "en" ? "en" : "de";
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "ADMIN")) {
    throw new Error("Not authorized.");
  }
  return session;
}

export async function importAirspaceAction(formData: FormData) {
  const session = await requireAdmin();
  const locale = safeLocale(formData.get("locale"));
  const file = formData.get("airspaceFile");
  const maxBytes = configuredLimit("SIMSOAR_AIRSPACE_MAX_BYTES", DEFAULT_MAX_BYTES, ABSOLUTE_MAX_BYTES);
  if (!(file instanceof File) || file.size === 0 || file.size > maxBytes) {
    redirect(`/${locale}/admin/airspaces?error=size`);
  }

  const sourceName = file.name.trim().slice(0, 120);
  if (!/\.(?:txt|air|openair)$/i.test(sourceName)) {
    redirect(`/${locale}/admin/airspaces?error=type`);
  }

  const parsed = parseOpenAir(await file.text());
  if (parsed.length === 0) {
    redirect(`/${locale}/admin/airspaces?error=content`);
  }

  const validation = validateAirspaceImport(parsed, {
    maxAirspaces: configuredLimit("SIMSOAR_AIRSPACE_MAX_COUNT", DEFAULT_MAX_AIRSPACES, ABSOLUTE_MAX_AIRSPACES),
    maxPointsPerAirspace: configuredLimit(
      "SIMSOAR_AIRSPACE_MAX_POINTS_PER_AIRSPACE",
      DEFAULT_MAX_POINTS_PER_AIRSPACE,
      ABSOLUTE_MAX_POINTS_PER_AIRSPACE
    ),
    maxTotalPoints: configuredLimit(
      "SIMSOAR_AIRSPACE_MAX_TOTAL_POINTS",
      DEFAULT_MAX_TOTAL_POINTS,
      ABSOLUTE_MAX_TOTAL_POINTS
    )
  });
  if (!validation.ok) redirect(`/${locale}/admin/airspaces?error=${validation.reason}`);

  const prepared = parsed.map((airspace) => ({
    id: crypto.randomUUID(),
    airspace,
    bounds: airspaceBounds(airspace.points)
  }));

  await prisma.$transaction(async (tx) => {
    for (const airspaceBatch of chunks(prepared, AIRSPACE_BATCH_SIZE)) {
      await tx.airspace.createMany({
        data: airspaceBatch.map(({id, airspace, bounds}) => ({
          id,
          name: airspace.name.slice(0, 160),
          className: airspace.className.slice(0, 40),
          floorLabel: airspace.floorLabel.slice(0, 80),
          ceilingLabel: airspace.ceilingLabel.slice(0, 80),
          sourceName,
          importedByUserId: session.user.id,
          ...bounds
        }))
      });

      let pointBatch: Array<{airspaceId: string; seq: number; lat: number; lon: number}> = [];
      for (const {id, airspace} of airspaceBatch) {
        for (let seq = 0; seq < airspace.points.length; seq += 1) {
          const point = airspace.points[seq];
          pointBatch.push({airspaceId: id, seq, lat: point.lat, lon: point.lon});
          if (pointBatch.length === POINT_BATCH_SIZE) {
            await tx.airspacePoint.createMany({data: pointBatch});
            pointBatch = [];
          }
        }
      }
      if (pointBatch.length > 0) await tx.airspacePoint.createMany({data: pointBatch});
    }
  }, {
    maxWait: 30_000,
    timeout: configuredLimit("SIMSOAR_AIRSPACE_IMPORT_TIMEOUT_MS", 10 * 60_000, 30 * 60_000)
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "AIRSPACE_IMPORT",
    targetType: "AirspaceImport",
    summary: "OpenAir polygon data was imported by an administrator.",
    metadata: {sourceName, airspaceCount: parsed.length, pointCount: validation.totalPoints}
  });

  revalidatePath(`/${locale}/admin/airspaces`);
  redirect(`/${locale}/admin/airspaces?imported=${parsed.length}`);
}

export async function deleteAirspaceAction(formData: FormData) {
  const session = await requireAdmin();
  const locale = safeLocale(formData.get("locale"));
  const airspaceId = String(formData.get("airspaceId") ?? "");
  const airspace = await prisma.airspace.delete({where: {id: airspaceId}});

  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "AIRSPACE_DELETE",
    targetType: "Airspace",
    targetId: airspace.id,
    summary: "Imported airspace polygon was removed by an administrator.",
    metadata: {name: airspace.name, sourceName: airspace.sourceName}
  });

  revalidatePath(`/${locale}/admin/airspaces`);
  redirect(`/${locale}/admin/airspaces?deleted=1`);
}
