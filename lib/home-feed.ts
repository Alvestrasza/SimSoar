import type {Prisma} from "@prisma/client";

export type HomeFeedMode = "PUBLIC" | "OWN" | "FOLLOWING";

export type HomeFeedPreference = {
  homeFeedMode?: HomeFeedMode | null;
  homeFeedSimulator?: string | null;
  homeFeedCompetitionClass?: string | null;
};

function cleanOptionalFilter(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned.slice(0, 80) : null;
}

export function buildHomeFeedWhere(
  viewerUserId: string | null | undefined,
  preference: HomeFeedPreference | null | undefined
): Prisma.FlightWhereInput {
  const requestedMode = preference?.homeFeedMode ?? "PUBLIC";
  const mode = viewerUserId ? requestedMode : "PUBLIC";
  const simulator = cleanOptionalFilter(preference?.homeFeedSimulator);
  const competitionClass = cleanOptionalFilter(
    preference?.homeFeedCompetitionClass
  );

  return {
    visibility: "PUBLIC",
    moderationStatus: "APPROVED",
    deletedAt: null,
    ...(mode === "OWN" && viewerUserId ? {userId: viewerUserId} : {}),
    ...(mode === "FOLLOWING" && viewerUserId
      ? {
          user: {
            followers: {some: {followerId: viewerUserId}}
          }
        }
      : {}),
    ...(simulator ? {simulator} : {}),
    ...(competitionClass ? {competitionClass} : {})
  };
}
