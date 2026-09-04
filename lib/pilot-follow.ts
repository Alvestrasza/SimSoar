import type {Prisma} from "@prisma/client";

export type FollowIntent = "follow" | "unfollow";

export function parseFollowIntent(value: FormDataEntryValue | null): FollowIntent {
  if (value === "follow" || value === "unfollow") return value;
  throw new Error("Invalid follow action.");
}

export function canFollowPilot(viewerUserId: string, pilotUserId: string): boolean {
  return Boolean(pilotUserId) && viewerUserId !== pilotUserId;
}

export function buildFollowedPublicFlightsWhere(
  followerId: string
): Prisma.FlightWhereInput {
  return {
    visibility: "PUBLIC",
    moderationStatus: "APPROVED",
    deletedAt: null,
    user: {
      followers: {
        some: {followerId}
      }
    }
  };
}
