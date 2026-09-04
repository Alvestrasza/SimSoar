import {prisma} from "./db";
import {detectSegmentCompletion} from "./segment-policy";

const publicFlightWhere = {visibility: "PUBLIC", moderationStatus: "APPROVED", deletedAt: null} as const;

export async function recalculateFlightSegments(flightId: string) {
  const flight = await prisma.flight.findUnique({where: {id: flightId}, include: {track: {orderBy: {seq: "asc"}}}});
  await prisma.flightSegmentResult.deleteMany({where: {flightId}});
  if (!flight || flight.visibility !== "PUBLIC" || flight.moderationStatus !== "APPROVED" || flight.deletedAt) return;
  const segments = await prisma.flightSegment.findMany({where: {active: true}});
  const results = segments.flatMap((segment) => {
    const completion = detectSegmentCompletion(segment, flight.track);
    return completion ? [{segmentId: segment.id, flightId: flight.id, userId: flight.userId, ...completion}] : [];
  });
  if (results.length) await prisma.flightSegmentResult.createMany({data: results});
}

export async function recalculateSegmentFlights(segmentId: string) {
  const segment = await prisma.flightSegment.findUnique({where: {id: segmentId}});
  await prisma.flightSegmentResult.deleteMany({where: {segmentId}});
  if (!segment?.active) return;
  const flights = await prisma.flight.findMany({where: publicFlightWhere, include: {track: {orderBy: {seq: "asc"}}}});
  const results = flights.flatMap((flight) => {
    const completion = detectSegmentCompletion(segment, flight.track);
    return completion ? [{segmentId, flightId: flight.id, userId: flight.userId, ...completion}] : [];
  });
  for (let index = 0; index < results.length; index += 1000) await prisma.flightSegmentResult.createMany({data: results.slice(index, index + 1000)});
}
