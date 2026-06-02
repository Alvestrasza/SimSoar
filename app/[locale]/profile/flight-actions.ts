"use server";

import fs from "node:fs/promises";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {writeAuditLog} from "@/lib/audit";

const flightIdSchema = z.string().min(1);
const visibilitySchema = z.enum(["PUBLIC", "PRIVATE", "UNLISTED"]);

function safeReturnTo(value: FormDataEntryValue | null) {
  const returnTo = typeof value === "string" ? value : "/de/profile";

  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return "/de/profile";
  }

  return returnTo;
}

function revalidateFlightViews(flightId: string) {
  revalidatePath("/");
  revalidatePath("/de");
  revalidatePath("/en");
  revalidatePath("/de/flights");
  revalidatePath("/en/flights");
  revalidatePath("/de/pilots");
  revalidatePath("/en/pilots");
  revalidatePath("/de/profile");
  revalidatePath("/en/profile");
  revalidatePath(`/de/flights/${flightId}`);
  revalidatePath(`/en/flights/${flightId}`);
}

export async function setFlightVisibilityAction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated.");
  }

  const flightId = flightIdSchema.parse(formData.get("flightId"));
  const visibility = visibilitySchema.parse(formData.get("visibility"));
  const returnTo = safeReturnTo(formData.get("returnTo"));

  const currentFlight = await prisma.flight.findFirst({
    where: {
      id: flightId,
      userId: session.user.id,
      deletedAt: null,
      moderationStatus: "APPROVED"
    },
    select: {
      id: true,
      title: true,
      pilotCallsign: true,
      visibility: true,
      moderationStatus: true
    }
  });

  if (!currentFlight) {
    throw new Error("Flight not found or not authorized.");
  }

  const updatedFlight = await prisma.flight.update({
    where: {
      id: currentFlight.id
    },
    data: {
      visibility
    },
    select: {
      id: true,
      title: true,
      pilotCallsign: true,
      visibility: true,
      moderationStatus: true
    }
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "FLIGHT_HIDE",
    targetType: "Flight",
    targetId: updatedFlight.id,
    summary: "Flight visibility was changed by the owner.",
    metadata: {
      title: updatedFlight.title,
      pilotCallsign: updatedFlight.pilotCallsign,
      previousVisibility: currentFlight.visibility,
      newVisibility: updatedFlight.visibility,
      moderationStatus: updatedFlight.moderationStatus
    }
  });

  revalidateFlightViews(flightId);
  redirect(`${returnTo}?flightUpdated=1`);
}

export async function deleteFlightAction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated.");
  }

  const flightId = flightIdSchema.parse(formData.get("flightId"));
  const returnTo = safeReturnTo(formData.get("returnTo"));

  const flight = await prisma.flight.findFirst({
    where: {
      id: flightId,
      userId: session.user.id,
      deletedAt: null
    },
    select: {
      id: true,
      title: true,
      pilotCallsign: true,
      visibility: true,
      moderationStatus: true,
      igcObjectPath: true,
      igcSha256: true
    }
  });

  if (!flight) {
    throw new Error("Flight not found or not authorized.");
  }

  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "FLIGHT_DELETE",
    targetType: "Flight",
    targetId: flight.id,
    summary: "Flight was deleted by the owner.",
    metadata: {
      title: flight.title,
      pilotCallsign: flight.pilotCallsign,
      visibility: flight.visibility,
      moderationStatus: flight.moderationStatus,
      igcSha256: flight.igcSha256,
      deleteMode: "hard-delete-by-owner"
    }
  });

  await prisma.flight.delete({
    where: {
      id: flight.id
    }
  });

  try {
    await fs.unlink(flight.igcObjectPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code !== "ENOENT") {
      console.error("Could not delete IGC file:", {
        flightId: flight.id,
        path: flight.igcObjectPath,
        error
      });
    }
  }

  revalidateFlightViews(flightId);
  redirect(`${returnTo}?flightDeleted=1`);
}
