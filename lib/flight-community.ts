export type CommunityFlightState = {
  visibility: "PUBLIC" | "PRIVATE" | "UNLISTED";
  moderationStatus: "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN";
  deletedAt: Date | string | null;
};

export function canInteractWithFlight(flight: CommunityFlightState): boolean {
  return (
    flight.visibility === "PUBLIC" &&
    flight.moderationStatus === "APPROVED" &&
    flight.deletedAt === null
  );
}

export function canDeleteFlightComment(
  actorUserId: string,
  commentAuthorUserId: string,
  flightOwnerUserId: string,
  canModerate: boolean
): boolean {
  return (
    canModerate ||
    actorUserId === commentAuthorUserId ||
    actorUserId === flightOwnerUserId
  );
}
