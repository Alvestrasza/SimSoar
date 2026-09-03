"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {parseOpenAir} from "@/lib/airspace";
import {writeAuditLog} from "@/lib/audit";

const DEFAULT_MAX_BYTES = 1024 * 1024;
const ABSOLUTE_MAX_BYTES = 5 * 1024 * 1024;

function uploadLimit() {
  const configured = Number(process.env.SIMSOAR_AIRSPACE_MAX_BYTES);
  return Number.isFinite(configured) && configured > 0
    ? Math.min(Math.floor(configured), ABSOLUTE_MAX_BYTES)
    : DEFAULT_MAX_BYTES;
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
  if (!(file instanceof File) || file.size === 0 || file.size > uploadLimit()) {
    redirect(`/${locale}/admin/airspaces?error=size`);
  }

  const sourceName = file.name.trim().slice(0, 120);
  if (!/\.(?:txt|air|openair)$/i.test(sourceName)) {
    redirect(`/${locale}/admin/airspaces?error=type`);
  }

  const parsed = parseOpenAir(await file.text());
  if (parsed.length === 0 || parsed.length > 200 || parsed.some((airspace) => airspace.points.length > 500)) {
    redirect(`/${locale}/admin/airspaces?error=content`);
  }

  await prisma.$transaction(async (tx) => {
    for (const airspace of parsed) {
      await tx.airspace.create({
        data: {
          name: airspace.name.slice(0, 160),
          className: airspace.className.slice(0, 40),
          floorLabel: airspace.floorLabel.slice(0, 80),
          ceilingLabel: airspace.ceilingLabel.slice(0, 80),
          sourceName,
          importedByUserId: session.user.id,
          points: {createMany: {data: airspace.points.map((point, seq) => ({seq, lat: point.lat, lon: point.lon}))}}
        }
      });
    }
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "AIRSPACE_IMPORT",
    targetType: "AirspaceImport",
    summary: "OpenAir polygon data was imported by an administrator.",
    metadata: {sourceName, airspaceCount: parsed.length}
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
