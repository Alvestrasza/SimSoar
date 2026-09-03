"use server";

import {auth} from "@/auth";
import {writeAuditLog} from "@/lib/audit";
import {prisma} from "@/lib/db";
import {
  canDeleteFlightComment,
  canInteractWithFlight
} from "@/lib/flight-community";
import {hasRole} from "@/lib/rbac";
import {createNotification} from "@/lib/notifications";
import {revalidatePath} from "next/cache";
import {z} from "zod";

const flightActionSchema = z.object({
  flightId: z.string().min(1).max(64),
  locale: z.enum(["de", "en"]).default("de")
});

const commentSchema = flightActionSchema.extend({
  content: z.string().trim().min(1).max(2000)
});

const commentActionSchema = flightActionSchema.extend({
  commentId: z.string().min(1).max(64)
});

const reportSchema = commentActionSchema.extend({
  reason: z.string().trim().max(500).transform((value) => value || null)
});

function revalidateCommunity(flightId: string) {
  revalidatePath(`/de/flights/${flightId}`);
  revalidatePath(`/en/flights/${flightId}`);
}

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated.");
  return session;
}

async function requireInteractableFlight(flightId: string) {
  const flight = await prisma.flight.findUnique({
    where: {id: flightId},
    select: {
      id: true,
      userId: true,
      title: true,
      visibility: true,
      moderationStatus: true,
      deletedAt: true
    }
  });

  if (!flight || !canInteractWithFlight(flight)) {
    throw new Error("This flight is not available for community interaction.");
  }

  return flight;
}

export async function toggleFlightLikeAction(formData: FormData) {
  const session = await requireUser();
  const fields = flightActionSchema.parse({
    flightId: formData.get("flightId"),
    locale: formData.get("locale") || "de"
  });
  const flight = await requireInteractableFlight(fields.flightId);

  const existing = await prisma.flightLike.findUnique({
    where: {
      flightId_userId: {flightId: flight.id, userId: session.user.id}
    },
    select: {id: true}
  });

  if (existing) {
    await prisma.flightLike.delete({where: {id: existing.id}});
  } else {
    await prisma.flightLike.create({
      data: {flightId: flight.id, userId: session.user.id}
    });

    await createNotification({
      recipientUserId: flight.userId,
      actorUserId: session.user.id,
      type: "FLIGHT_LIKE",
      flightId: flight.id
    });
  }

  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: existing ? "FLIGHT_UNLIKE" : "FLIGHT_LIKE",
    targetType: "Flight",
    targetId: flight.id,
    summary: existing ? "Flight like was removed." : "Flight was liked.",
    metadata: {title: flight.title}
  });

  revalidateCommunity(flight.id);
}

export async function createFlightCommentAction(formData: FormData) {
  const session = await requireUser();
  const fields = commentSchema.parse({
    flightId: formData.get("flightId"),
    locale: formData.get("locale") || "de",
    content: formData.get("content")
  });
  const flight = await requireInteractableFlight(fields.flightId);

  const comment = await prisma.flightComment.create({
    data: {
      flightId: flight.id,
      userId: session.user.id,
      content: fields.content
    },
    select: {id: true}
  });

  await createNotification({
    recipientUserId: flight.userId,
    actorUserId: session.user.id,
    type: "FLIGHT_COMMENT",
    flightId: flight.id,
    commentId: comment.id
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "FLIGHT_COMMENT_CREATE",
    targetType: "FlightComment",
    targetId: comment.id,
    summary: "Comment was added to a public flight.",
    metadata: {flightId: flight.id, title: flight.title}
  });

  revalidateCommunity(flight.id);
}

export async function deleteFlightCommentAction(formData: FormData) {
  const session = await requireUser();
  const fields = commentActionSchema.parse({
    flightId: formData.get("flightId"),
    commentId: formData.get("commentId"),
    locale: formData.get("locale") || "de"
  });
  const flight = await requireInteractableFlight(fields.flightId);
  const comment = await prisma.flightComment.findFirst({
    where: {id: fields.commentId, flightId: flight.id},
    select: {id: true, userId: true, deletedAt: true}
  });

  if (!comment) throw new Error("Comment not found.");
  if (comment.deletedAt) return;

  const canModerate = hasRole(session.user.roles, "MODERATOR");
  if (
    !canDeleteFlightComment(
      session.user.id,
      comment.userId,
      flight.userId,
      canModerate
    )
  ) {
    throw new Error("Not authorized to remove this comment.");
  }

  await prisma.flightComment.update({
    where: {id: comment.id},
    data: {deletedAt: new Date(), deletedByUserId: session.user.id}
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "FLIGHT_COMMENT_DELETE",
    targetType: "FlightComment",
    targetId: comment.id,
    summary: "Flight comment was soft deleted.",
    metadata: {flightId: flight.id, commentAuthorUserId: comment.userId}
  });

  revalidateCommunity(flight.id);
}

export async function reportFlightCommentAction(formData: FormData) {
  const session = await requireUser();
  const fields = reportSchema.parse({
    flightId: formData.get("flightId"),
    commentId: formData.get("commentId"),
    locale: formData.get("locale") || "de",
    reason: formData.get("reason") || ""
  });
  const flight = await requireInteractableFlight(fields.flightId);
  const comment = await prisma.flightComment.findFirst({
    where: {id: fields.commentId, flightId: flight.id, deletedAt: null},
    select: {id: true, userId: true}
  });

  if (!comment) throw new Error("Comment not found.");
  if (comment.userId === session.user.id) {
    throw new Error("Users cannot report their own comment.");
  }

  await prisma.flightCommentReport.upsert({
    where: {
      commentId_reporterId: {
        commentId: comment.id,
        reporterId: session.user.id
      }
    },
    create: {
      commentId: comment.id,
      reporterId: session.user.id,
      reason: fields.reason
    },
    update: {reason: fields.reason}
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "FLIGHT_COMMENT_REPORT",
    targetType: "FlightComment",
    targetId: comment.id,
    summary: "Flight comment was reported for moderation.",
    metadata: {flightId: flight.id, reasonProvided: Boolean(fields.reason)}
  });

  revalidateCommunity(flight.id);
}
