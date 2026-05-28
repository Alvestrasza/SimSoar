import {notFound} from "next/navigation";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
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

  if (flight.visibility === "PRIVATE" && !isOwner) {
    notFound();
  }

  return (
    <FlightDetailClient
      flight={{
        id: flight.id,
        title: flight.title,
        pilotCallsign: flight.pilotCallsign,
        simulator: flight.simulator,
        glider: flight.glider,
        registration: flight.registration,
        competitionClass: flight.competitionClass,
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
        canManage: isOwner,
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