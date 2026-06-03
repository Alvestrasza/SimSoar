"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {writeAuditLog} from "@/lib/audit";

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
  comment: z.string().trim().max(2000).optional()
});

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
  revalidatePath(`/${locale}/flights/${flightId}`);
  revalidatePath(`/${locale}/flights/${flightId}/edit`);
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
      comment: true,
      moderationStatus: true,
      deletedAt: true
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

  const updatedFlight = await prisma.flight.update({
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
      comment: fields.comment
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
      comment: true,
      moderationStatus: true
    }
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "FLIGHT_UPDATE",
    targetType: "Flight",
    targetId: updatedFlight.id,
    summary: "Flight metadata was updated.",
    metadata: {
      previous: {
        title: currentFlight.title,
        simulator: currentFlight.simulator,
        glider: currentFlight.glider,
        registration: currentFlight.registration,
        competitionClass: currentFlight.competitionClass,
        weatherMode: currentFlight.weatherMode,
        visibility: currentFlight.visibility,
        comment: currentFlight.comment
      },
      current: {
        title: updatedFlight.title,
        simulator: updatedFlight.simulator,
        glider: updatedFlight.glider,
        registration: updatedFlight.registration,
        competitionClass: updatedFlight.competitionClass,
        weatherMode: updatedFlight.weatherMode,
        visibility: updatedFlight.visibility,
        comment: updatedFlight.comment
      },
      pilotCallsign: updatedFlight.pilotCallsign,
      moderationStatus: updatedFlight.moderationStatus
    }
  });

  revalidateFlightViews(fields.locale, updatedFlight.id);

  redirect(`/${fields.locale}/flights/${updatedFlight.id}`);
}
