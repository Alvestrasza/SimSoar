import {notFound} from "next/navigation";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {resolveIgcDownloadMode} from "@/lib/igc-download";
import FlightDetailClient from "@/app/components/FlightDetailClient";
import {setRequestLocale} from "next-intl/server";

export const dynamic = "force-dynamic";

type FlightDetailPageProps = {
  params: Promise<{
    locale: string;
    id: string;
  }>;
};

export default async function FlightDetailPage({
  params
}: FlightDetailPageProps) {
  const {locale, id} = await params;

  setRequestLocale(locale);

  const flight = await prisma.flight.findUnique({
    where: {
      id
    },
    include: {
      track: {
        orderBy: {
          seq: "asc"
        }
      },
      thermals: {
        orderBy: {
          seq: "asc"
        }
      }
    }
  });

  if (!flight) {
    notFound();
  }

  let session = null;

  try {
    session = await auth();
  } catch (error) {
    console.error("SimSoar flight detail auth session could not be loaded:", error);
  }

  const isOwner = session?.user?.id === flight.userId;
  const canModerate = hasRole(session?.user?.roles, "MODERATOR");

  const preferences = session?.user?.id
  ? await prisma.userPreference.findUnique({
      where: {
        userId: session.user.id
      },
      select: {
        preferredMapMode: true
      }
    })
  : null;

  const preferredMapMode = preferences?.preferredMapMode ?? "STANDARD";

  const isDeleted = flight.deletedAt !== null;

  const isApprovedAndActive =
    flight.moderationStatus === "APPROVED" &&
    !isDeleted;

  const isPublicOrUnlisted =
    flight.visibility === "PUBLIC" ||
    flight.visibility === "UNLISTED";

  const canViewFlight =
    canModerate ||
    isOwner ||
    (isApprovedAndActive && isPublicOrUnlisted);

  if (!canViewFlight) {
    notFound();
  }

  const isLockedByModeration =
    isDeleted || flight.moderationStatus !== "APPROVED";

  const igcDownloadMode = resolveIgcDownloadMode(flight, {
    userId: session?.user?.id,
    isAdmin: hasRole(session?.user?.roles, "ADMIN")
  });

  return (
    <FlightDetailClient
      preferredMapMode={preferredMapMode}
      flight={{
        id: flight.id,
        title: flight.title,
        pilotCallsign: flight.pilotCallsign,
        simulator: flight.simulator,
        glider: flight.glider,
        registration: flight.registration,
        competitionClass: flight.competitionClass,
        weatherMode: flight.weatherMode,
        comment: flight.comment,
        startTime: flight.startTime?.toISOString() ?? null,
        durationSeconds: flight.durationSeconds,
        distanceKm: flight.distanceKm,
        olcPoints: flight.olcPoints,
        avgSpeedKmh: flight.avgSpeedKmh,
        maxAltitudeM: flight.maxAltitudeM,
        minAltitudeM: flight.minAltitudeM,
        maxVarioMs: flight.maxVarioMs,
        visibility: flight.visibility,
        publicIgcDownloadEnabled: flight.publicIgcDownloadEnabled,
        canDownloadIgc: igcDownloadMode !== null,
        canManage: canModerate || (isOwner && !isLockedByModeration),
        track: flight.track.map((p: any) => ({
          seq: p.seq,
          lat: p.lat,
          lon: p.lon,
          altM: p.altM,
          varioMs: p.varioMs
        })),
        thermals: flight.thermals.map((t: any) => ({
          id: t.id,
          seq: t.seq,
          centerLat: t.centerLat,
          centerLon: t.centerLon,
          avgClimbMs: t.avgClimbMs,
          maxClimbMs: t.maxClimbMs,
          gainM: t.gainM,
          durationSec: t.durationSec
        }))
      }}
    />
  );
}
