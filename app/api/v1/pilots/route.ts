import {prisma} from "@/lib/db";
import {PUBLIC_FLIGHT_WHERE, parsePublicApiPagination} from "@/lib/public-api";
import {publicApiJson, publicApiRateLimitResponse} from "@/lib/public-api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const publicPilotWhere = {user: {flights: {some: PUBLIC_FLIGHT_WHERE}}} as const;

export async function GET(request: Request) {
  const {rateLimit, response} = publicApiRateLimitResponse(request);
  if (response) return response;
  const {limit, page, skip} = parsePublicApiPagination(new URL(request.url).searchParams);
  const [total, profiles] = await Promise.all([
    prisma.pilotProfile.count({where: publicPilotWhere}),
    prisma.pilotProfile.findMany({
      where: publicPilotWhere, orderBy: {callsign: "asc"}, skip, take: limit,
      select: {userId: true, callsign: true, country: true, favoriteSim: true, favoriteGlider: true, bio: true,
        user: {select: {flights: {where: PUBLIC_FLIGHT_WHERE, select: {distanceKm: true, olcPoints: true}}}}}
    })
  ]);
  const data = profiles.map((profile) => ({
    id: profile.userId,
    callsign: profile.callsign,
    country: profile.country,
    favoriteSimulator: profile.favoriteSim,
    favoriteGlider: profile.favoriteGlider,
    bio: profile.bio,
    publicFlightCount: profile.user.flights.length,
    totalDistanceKm: profile.user.flights.reduce((sum, flight) => sum + flight.distanceKm, 0),
    totalOlcPoints: profile.user.flights.reduce((sum, flight) => sum + flight.olcPoints, 0)
  }));
  return publicApiJson({data, pagination: {page, limit, total, pages: Math.ceil(total / limit)}}, {rateLimit});
}
