import {prisma} from "@/lib/db";
import {PUBLIC_FLIGHT_WHERE, parsePublicApiPagination, publicFlightSummary} from "@/lib/public-api";
import {publicApiJson, publicApiRateLimitResponse} from "@/lib/public-api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const publicFlightSelect = {
  id: true, title: true, pilotCallsign: true, simulator: true, glider: true, competitionClass: true,
  startTime: true, durationSeconds: true, distanceKm: true, olcPoints: true, avgSpeedKmh: true,
  maxAltitudeM: true, maxVarioMs: true, createdAt: true, updatedAt: true
} as const;

export async function GET(request: Request) {
  const {rateLimit, response} = publicApiRateLimitResponse(request);
  if (response) return response;
  const url = new URL(request.url);
  const {limit, page, skip} = parsePublicApiPagination(url.searchParams);
  const [total, flights] = await Promise.all([
    prisma.flight.count({where: PUBLIC_FLIGHT_WHERE}),
    prisma.flight.findMany({where: PUBLIC_FLIGHT_WHERE, orderBy: [{startTime: "desc"}, {createdAt: "desc"}], skip, take: limit, select: publicFlightSelect})
  ]);
  return publicApiJson({data: flights.map(publicFlightSummary), pagination: {page, limit, total, pages: Math.ceil(total / limit)}}, {rateLimit});
}
