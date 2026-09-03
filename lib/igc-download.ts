export type IgcDownloadMode = "admin" | "owner" | "public";

type IgcDownloadAccessFlight = {
  userId: string;
  visibility: "PUBLIC" | "PRIVATE" | "UNLISTED";
  moderationStatus: "APPROVED" | "REJECTED" | "HIDDEN" | "PENDING";
  deletedAt: Date | null;
  publicIgcDownloadEnabled: boolean;
};

type IgcDownloadViewer = {
  userId: string | null | undefined;
  isAdmin: boolean;
};

export function safeDownloadPart(
  value: string | null | undefined,
  fallback: string
) {
  const cleaned = (value ?? fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 80);

  return cleaned || fallback;
}

export function buildIgcFileName(flight: {
  id: string;
  pilotCallsign: string;
  startTime: Date | null;
  createdAt: Date;
}) {
  const datePart = (flight.startTime ?? flight.createdAt)
    .toISOString()
    .slice(0, 10);

  const callsignPart = safeDownloadPart(flight.pilotCallsign, "pilot");

  return `${datePart}_${callsignPart}_${flight.id}.igc`;
}

export function canPublicDownload(
  flight: Pick<
    IgcDownloadAccessFlight,
    | "visibility"
    | "moderationStatus"
    | "deletedAt"
    | "publicIgcDownloadEnabled"
  >
) {
  return (
    flight.publicIgcDownloadEnabled &&
    flight.deletedAt === null &&
    flight.moderationStatus === "APPROVED" &&
    flight.visibility !== "PRIVATE"
  );
}

export function resolveIgcDownloadMode(
  flight: IgcDownloadAccessFlight,
  viewer: IgcDownloadViewer
): IgcDownloadMode | null {
  if (viewer.isAdmin) {
    return "admin";
  }

  if (viewer.userId && viewer.userId === flight.userId) {
    return "owner";
  }

  if (canPublicDownload(flight)) {
    return "public";
  }

  return null;
}
