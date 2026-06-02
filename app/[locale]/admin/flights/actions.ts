"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import type {AuditAction} from "@prisma/client";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {writeAuditLog} from "@/lib/audit";

const moderationSchema = z.object({
  flightId: z.string().min(1),
  moderationStatus: z.enum(["APPROVED", "REJECTED", "HIDDEN"]),
  moderationNote: z.string().max(2000).optional(),
  returnTo: z.string().min(1).optional()
});

function safeReturnTo(value: string | undefined) {
  const returnTo = value || "/de/admin/flights";

  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return "/de/admin/flights";
  }

  return returnTo;
}

function revalidateFlightAdminViews(flightId: string) {
  revalidatePath("/");
  revalidatePath("/de");
  revalidatePath("/en");
  revalidatePath("/de/flights");
  revalidatePath("/en/flights");
  revalidatePath("/de/pilots");
  revalidatePath("/en/pilots");
  revalidatePath("/de/admin");
  revalidatePath("/en/admin");
  revalidatePath("/de/admin/flights");
  revalidatePath("/en/admin/flights");
  revalidatePath(`/de/flights/${flightId}`);
  revalidatePath(`/en/flights/${flightId}`);
}

const auditActionByStatus: Record<
  "APPROVED" | "REJECTED" | "HIDDEN",
  AuditAction
> = {
  APPROVED: "FLIGHT_APPROVE",
  REJECTED: "FLIGHT_REJECT",
  HIDDEN: "FLIGHT_HIDE"
};

export async function moderateFlightAction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated.");
  }

  if (!hasRole(session.user.roles, "MODERATOR")) {
    throw new Error("Not authorized.");
  }

  const fields = moderationSchema.parse({
    flightId: formData.get("flightId"),
    moderationStatus: formData.get("moderationStatus"),
    moderationNote: formData.get("moderationNote") || undefined,
    returnTo: formData.get("returnTo") || undefined
  });

  const returnTo = safeReturnTo(fields.returnTo);

  const flight = await prisma.flight.update({
    where: {
      id: fields.flightId
    },
    data: {
      moderationStatus: fields.moderationStatus,
      moderatedByUserId: session.user.id,
      moderatedAt: new Date(),
      moderationNote: fields.moderationNote?.trim() || null
    },
    select: {
      id: true,
      title: true,
      pilotCallsign: true,
      visibility: true,
      moderationStatus: true,
      moderationNote: true
    }
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: auditActionByStatus[fields.moderationStatus],
    targetType: "Flight",
    targetId: flight.id,
    summary: `Flight moderation status changed to ${fields.moderationStatus}.`,
    metadata: {
      title: flight.title,
      pilotCallsign: flight.pilotCallsign,
      visibility: flight.visibility,
      moderationStatus: flight.moderationStatus,
      moderationNote: flight.moderationNote
    }
  });

  revalidateFlightAdminViews(flight.id);

  redirect(`${returnTo}?updated=1`);
}
