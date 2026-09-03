import {notFound} from "next/navigation";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {resolveIgcDownloadMode} from "@/lib/igc-download";
import FlightDetailClient from "@/app/components/FlightDetailClient";
import FlightCommunitySection from "@/app/components/FlightCommunitySection";
import {
  canDeleteFlightComment,
  canInteractWithFlight
} from "@/lib/flight-community";
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

  const communityEnabled = canInteractWithFlight(flight);
  const [likeCount, viewerLike, communityComments] = communityEnabled
    ? await Promise.all([
        prisma.flightLike.count({where: {flightId: flight.id}}),
        session?.user?.id
          ? prisma.flightLike.findUnique({
              where: {
                flightId_userId: {
                  flightId: flight.id,
                  userId: session.user.id
                }
              },
              select: {id: true}
            })
          : Promise.resolve(null),
        prisma.flightComment.findMany({
          where: {flightId: flight.id},
          orderBy: {createdAt: "asc"},
          take: 200,
          select: {
            id: true,
            userId: true,
            content: true,
            createdAt: true,
            deletedAt: true,
            user: {
              select: {
                name: true,
                profile: {select: {callsign: true}}
              }
            },
            reports: {
              where: {reporterId: session?.user?.id ?? "__anonymous__"},
              select: {id: true},
              take: 1
            }
          }
        })
      ])
    : [0, null, []];

  return (
    <>
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

      {communityEnabled ? (
        <FlightCommunitySection
          locale={locale}
          flightId={flight.id}
          likeCount={likeCount}
          likedByViewer={Boolean(viewerLike)}
          isAuthenticated={Boolean(session?.user?.id)}
          comments={communityComments.map((comment) => ({
            id: comment.id,
            content: comment.content,
            author:
              comment.user.profile?.callsign ??
              comment.user.name ??
              "Pilot",
            createdAt: comment.createdAt,
            deletedAt: comment.deletedAt,
            canDelete: session?.user?.id
              ? canDeleteFlightComment(
                  session.user.id,
                  comment.userId,
                  flight.userId,
                  canModerate
                )
              : false,
            canReport: Boolean(
              session?.user?.id && session.user.id !== comment.userId
            ),
            reportedByViewer: comment.reports.length > 0
          }))}
        />
      ) : null}
    </>
  );
}
