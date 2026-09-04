import {prisma} from "@/lib/db";
import {PUBLIC_FLIGHT_WHERE, parsePublicApiPagination} from "@/lib/public-api";
import {publicApiJson, publicApiRateLimitResponse} from "@/lib/public-api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const {rateLimit, response} = publicApiRateLimitResponse(request);
  if (response) return response;
  const {limit, page, skip} = parsePublicApiPagination(new URL(request.url).searchParams);
  const where = {...PUBLIC_FLIGHT_WHERE, user: {profile: {isNot: null}}};
  const [groups, allGroups] = await Promise.all([
    prisma.flight.groupBy({
      by: ["userId"], where, _count: {_all: true}, _sum: {distanceKm: true, olcPoints: true}, _max: {distanceKm: true},
      orderBy: [{_sum: {olcPoints: "desc"}}, {_max: {distanceKm: "desc"}}], skip, take: limit
    }),
    prisma.flight.groupBy({by: ["userId"], where})
  ]);
  const profiles = await prisma.pilotProfile.findMany({where: {userId: {in: groups.map((group) => group.userId)}}, select: {userId: true, callsign: true}});
  const callsigns = new Map(profiles.map((profile) => [profile.userId, profile.callsign]));
  const data = groups.map((group, index) => ({
    rank: skip + index + 1,
    pilotId: group.userId,
    callsign: callsigns.get(group.userId) ?? "Unknown",
    publicFlightCount: group._count._all,
    totalDistanceKm: group._sum.distanceKm ?? 0,
    bestDistanceKm: group._max.distanceKm ?? 0,
    totalOlcPoints: group._sum.olcPoints ?? 0
  }));
  const total = allGroups.length;
  return publicApiJson({data, pagination: {page, limit, total, pages: Math.ceil(total / limit)}, scoring: "totalOlcPoints"}, {rateLimit});
}
