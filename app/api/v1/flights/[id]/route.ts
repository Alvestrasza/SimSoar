import {prisma} from "@/lib/db";
import {simplifyFlightTrack} from "@/lib/flight-map";
import {PUBLIC_FLIGHT_WHERE, publicFlightSummary} from "@/lib/public-api";
import {publicApiJson, publicApiRateLimitResponse} from "@/lib/public-api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  const {rateLimit, response} = publicApiRateLimitResponse(request);
  if (response) return response;
  const {id} = await params;
  const flight = await prisma.flight.findFirst({
    where: {...PUBLIC_FLIGHT_WHERE, id},
    select: {
      id: true, title: true, pilotCallsign: true, simulator: true, glider: true, competitionClass: true,
      startTime: true, durationSeconds: true, distanceKm: true, olcPoints: true, avgSpeedKmh: true,
      maxAltitudeM: true, minAltitudeM: true, maxVarioMs: true, startLat: true, startLon: true,
      finishLat: true, finishLon: true, createdAt: true, updatedAt: true,
      track: {orderBy: {seq: "asc"}, select: {seq: true, time: true, lat: true, lon: true, altM: true}}
    }
  });
  if (!flight) return publicApiJson({error: {code: "not_found", message: "Public flight not found."}}, {status: 404, rateLimit});
  const track = simplifyFlightTrack(flight.track, 600);
  return publicApiJson({data: {
    ...publicFlightSummary(flight),
    minAltitudeM: flight.minAltitudeM,
    start: flight.startLat == null || flight.startLon == null ? null : {lat: flight.startLat, lon: flight.startLon},
    finish: flight.finishLat == null || flight.finishLon == null ? null : {lat: flight.finishLat, lon: flight.finishLon},
    trackPointCount: flight.track.length,
    track: track.map((point) => ({...point, time: point.time?.toISOString() ?? null}))
  }}, {rateLimit});
}
