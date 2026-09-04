import {notFound} from "next/navigation";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {resolveIgcDownloadMode} from "@/lib/igc-download";
import FlightDetailClient from "@/app/components/FlightDetailClient";
import FlightCommunitySection from "@/app/components/FlightCommunitySection";
import FlightStorySection from "@/app/components/FlightStorySection";
import {
  canDeleteFlightComment,
  canInteractWithFlight
} from "@/lib/flight-community";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {airspaceBounds, findAirspaceCrossings} from "@/lib/airspace";
import type {Metadata} from "next";
import FlightSharePanel from "@/app/components/FlightSharePanel";
import {buildFlightShareUrls, configuredPublicOrigin, flightShareDescription} from "@/lib/flight-sharing";
import {PUBLIC_FLIGHT_WHERE} from "@/lib/public-api";
import {appealAuthenticityAction, reviewAuthenticityAppealAction} from "./authenticity-actions";
import type {AuthenticityFinding} from "@/lib/authenticity";

export const dynamic = "force-dynamic";

type FlightDetailPageProps = {
  params: Promise<{
    locale: string;
    id: string;
  }>;
};

export async function generateMetadata({params}: FlightDetailPageProps): Promise<Metadata> {
  const {locale: requestedLocale, id} = await params;
  const locale = requestedLocale === "en" ? "en" : "de";
  const flight = await prisma.flight.findFirst({where: {...PUBLIC_FLIGHT_WHERE, id}, select: {id: true, title: true, pilotCallsign: true, simulator: true, glider: true, distanceKm: true, olcPoints: true}});
  if (!flight) return {title: "SimSoar", robots: {index: false, follow: false}};
  const urls = buildFlightShareUrls(configuredPublicOrigin(), locale, flight.id);
  const title = `${flight.title} · SimSoar`;
  const description = flightShareDescription(flight, locale);
  return {
    title,
    description,
    alternates: {canonical: urls.shareUrl},
    openGraph: {type: "article", title, description, url: urls.shareUrl, siteName: "SimSoar", images: [{url: urls.previewUrl, width: 1120, height: 630, alt: flight.title}]},
    twitter: {card: "summary_large_image", title, description, images: [urls.previewUrl]}
  };
}

export default async function FlightDetailPage({
  params
}: FlightDetailPageProps) {
  const {locale, id} = await params;

  setRequestLocale(locale);
  const tAuthenticity = await getTranslations({locale, namespace: "Authenticity"});

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
      },
      glidePhases: {
        orderBy: {
          seq: "asc"
        }
      },
      scoringPoints: {
        orderBy: {
          order: "asc"
        }
      },
      storyImages: {
        orderBy: {createdAt: "asc"}
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

  const authenticitySubmissions = isOwner || canModerate ? await prisma.flightAuthenticitySubmission.findMany({where: {flightId: flight.id}, orderBy: {revision: "desc"}, take: 20}) : [];

  const igcDownloadMode = resolveIgcDownloadMode(flight, {
    userId: session?.user?.id,
    isAdmin: hasRole(session?.user?.roles, "ADMIN")
  });

  const communityEnabled = canInteractWithFlight(flight);
  const isPublicShareable = flight.visibility === "PUBLIC" && isApprovedAndActive;
  const shareUrls = isPublicShareable ? buildFlightShareUrls(configuredPublicOrigin(), locale === "en" ? "en" : "de", flight.id) : null;
  const trackBounds = flight.track.length > 0 ? airspaceBounds(flight.track) : null;
  const activeAirspaces = trackBounds ? await prisma.airspace.findMany({
    where: {
      active: true,
      minLat: {lte: trackBounds.maxLat},
      maxLat: {gte: trackBounds.minLat},
      minLon: {lte: trackBounds.maxLon},
      maxLon: {gte: trackBounds.minLon}
    },
    orderBy: {createdAt: "desc"},
    include: {points: {orderBy: {seq: "asc"}}}
  }) : [];
  const airspaces = activeAirspaces.map((airspace) => ({
    id: airspace.id,
    name: airspace.name,
    className: airspace.className,
    floorLabel: airspace.floorLabel,
    ceilingLabel: airspace.ceilingLabel,
    points: airspace.points.map((point) => ({lat: point.lat, lon: point.lon}))
  }));
  const airspaceCrossings = findAirspaceCrossings(flight.track, airspaces);
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
        scoringRule: flight.scoringRule,
        scoringDistanceKm: flight.scoringDistanceKm,
        scoringMultiplier: flight.scoringMultiplier,
        scoringClosedCourse: flight.scoringClosedCourse,
        suggestedScoringStartSeq: flight.suggestedScoringStartSeq,
        suggestedScoringEndSeq: flight.suggestedScoringEndSeq,
        scoringStartSeq: flight.scoringStartSeq,
        scoringEndSeq: flight.scoringEndSeq,
        scoringWindowMode: flight.scoringWindowMode,
        scoringWindowReasons: flight.scoringWindowReasons,
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
          varioMs: p.varioMs,
          time: p.time?.toISOString() ?? null
        })),
        thermals: flight.thermals.map((t: any) => ({
          id: t.id,
          seq: t.seq,
          startSeq: t.startSeq,
          endSeq: t.endSeq,
          centerLat: t.centerLat,
          centerLon: t.centerLon,
          avgClimbMs: t.avgClimbMs,
          maxClimbMs: t.maxClimbMs,
          gainM: t.gainM,
          durationSec: t.durationSec,
          efficiencyPercent: t.efficiencyPercent,
          windDirectionDeg: t.windDirectionDeg,
          windSpeedKmh: t.windSpeedKmh,
          windConfidence: t.windConfidence,
          windDriftDistanceM: t.windDriftDistanceM
        })),
        glidePhases: flight.glidePhases.map((phase: any) => ({
          id: phase.id,
          seq: phase.seq,
          startSeq: phase.startSeq,
          endSeq: phase.endSeq,
          durationSec: phase.durationSec,
          distanceKm: phase.distanceKm,
          avgSpeedKmh: phase.avgSpeedKmh,
          avgSinkMs: phase.avgSinkMs,
          glideRatio: phase.glideRatio
        })),
        scoringPoints: flight.scoringPoints.map((point) => ({
          id: point.id,
          order: point.order,
          trackSeq: point.trackSeq,
          lat: point.lat,
          lon: point.lon,
          legDistanceKm: point.legDistanceKm
        })),
        airspaces,
        airspaceCrossings
        }}
      />

      {shareUrls ? <FlightSharePanel title={flight.title} shareUrl={shareUrls.shareUrl} embedUrl={shareUrls.embedUrl} /> : null}

      {isOwner || canModerate ? <section className="card" style={{marginTop: 20}}><div className="cardHead"><div><span className="cardTitle">{tAuthenticity("title")}</span><p className="muted">{tAuthenticity("subtitle")}</p></div></div><div className="cardBody moderationCardGrid">{authenticitySubmissions.length ? authenticitySubmissions.map((submission) => {
        const findings = submission.findings as unknown as AuthenticityFinding[];
        return <article className="moderationCard" key={submission.id}><div><strong>{tAuthenticity("revision", {revision: submission.revision})} · {tAuthenticity(`status_${submission.status}`)}</strong><p className="muted">{submission.createdAt.toLocaleString(locale)} · SHA-256 {submission.evidenceSha256.slice(0, 12)}… · {submission.signed ? tAuthenticity(submission.signatureValid ? "signatureValid" : "signatureInvalid") : tAuthenticity("signatureMissing")}</p><p>{findings.length ? findings.map((finding) => `${finding.code} (${finding.severity})`).join(", ") : tAuthenticity("noFindings")}</p>{submission.appealText ? <div className="moderationNotice"><strong>{tAuthenticity("appeal")}: {submission.appealStatus}</strong><p>{submission.appealText}</p>{submission.appealResolution ? <p>{tAuthenticity("resolution")}: {submission.appealResolution}</p> : null}</div> : null}</div>
          {isOwner && submission.status !== "VERIFIED" && submission.appealStatus !== "OPEN" ? <form action={appealAuthenticityAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="submissionId" value={submission.id} /><label><span>{tAuthenticity("appealReason")}</span><textarea name="text" minLength={20} maxLength={2000} required /></label><button className="btn btnSecondary" type="submit">{tAuthenticity("submitAppeal")}</button></form> : null}
          {canModerate && submission.appealStatus === "OPEN" ? <form action={reviewAuthenticityAppealAction} className="formGrid"><input type="hidden" name="locale" value={locale} /><input type="hidden" name="submissionId" value={submission.id} /><label><span>{tAuthenticity("decision")}</span><select name="decision"><option value="ACCEPTED">{tAuthenticity("accept")}</option><option value="REJECTED">{tAuthenticity("reject")}</option></select></label><label className="full"><span>{tAuthenticity("resolution")}</span><textarea name="resolution" minLength={10} maxLength={2000} required /></label><button className="btn btnPrimary" type="submit">{tAuthenticity("reviewAppeal")}</button></form> : null}
        </article>;
      }) : <p className="muted">{tAuthenticity("empty")}</p>}</div></section> : null}

      <FlightStorySection
        locale={locale}
        flightId={flight.id}
        storyText={flight.storyText}
        images={flight.storyImages.map((image) => ({id: image.id, fileName: image.fileName}))}
        canEdit={(isOwner && !isLockedByModeration) || hasRole(session?.user?.roles, "ADMIN")}
        canRemove={isOwner || canModerate}
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
