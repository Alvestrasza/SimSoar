import type {FlightModerationStatus, NotificationType} from "@prisma/client";
import {prisma} from "@/lib/db";
import {shouldCreateNotification} from "@/lib/notification-policy";

type CreateNotificationInput = {
  recipientUserId: string;
  actorUserId?: string | null;
  type: NotificationType;
  flightId?: string | null;
  commentId?: string | null;
  moderationStatus?: FlightModerationStatus | null;
};

export async function createNotification({
  recipientUserId,
  actorUserId = null,
  type,
  flightId = null,
  commentId = null,
  moderationStatus = null
}: CreateNotificationInput) {
  if (!shouldCreateNotification(recipientUserId, actorUserId)) return null;

  return prisma.notification.create({
    data: {
      userId: recipientUserId,
      actorUserId,
      type,
      flightId,
      commentId,
      moderationStatus
    }
  });
}

export async function notifyFollowersAboutFlight(input: {
  pilotUserId: string;
  flightId: string;
  isPublicAndApproved: boolean;
}) {
  if (!input.isPublicAndApproved) return 0;

  const followers = await prisma.pilotFollow.findMany({
    where: {followingId: input.pilotUserId},
    select: {followerId: true}
  });

  if (followers.length === 0) return 0;

  const result = await prisma.notification.createMany({
    data: followers.map((follow) => ({
      userId: follow.followerId,
      actorUserId: input.pilotUserId,
      type: "FOLLOWED_PILOT_FLIGHT" as const,
      flightId: input.flightId
    }))
  });

  return result.count;
}
