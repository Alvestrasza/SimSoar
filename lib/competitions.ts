import crypto from "node:crypto";
import {prisma} from "@/lib/db";
import {competitionFlightScore, matchesCompetition} from "@/lib/competition-policy";

const flightSelect = {
  id: true,
  userId: true,
  startTime: true,
  createdAt: true,
  simulator: true,
  competitionClass: true,
  distanceKm: true,
  olcPoints: true,
  visibility: true,
  moderationStatus: true,
  deletedAt: true
} as const;

export async function archivePastCompetitions(now = new Date()) {
  return prisma.competition.updateMany({
    where: {status: "ACTIVE", endAt: {lt: now}},
    data: {status: "CLOSED", closedAt: now}
  });
}

export async function recalculateFlightCompetitions(flightId: string) {
  const flight = await prisma.flight.findUnique({where: {id: flightId}, select: flightSelect});
  if (!flight || flight.deletedAt || flight.moderationStatus !== "APPROVED" || flight.visibility !== "PUBLIC") {
    await prisma.competitionEntry.deleteMany({where: {flightId}});
    return [];
  }
  const date = flight.startTime ?? flight.createdAt;
  await archivePastCompetitions();
  const competitions = await prisma.competition.findMany({
    where: {status: "ACTIVE", startAt: {lte: date}, endAt: {gte: date}}
  });
  const matches = competitions.filter((competition) => matchesCompetition(competition, flight));
  const matchIds = matches.map((competition) => competition.id);
  await prisma.$transaction(async (tx) => {
    await tx.competitionEntry.deleteMany({
      where: matchIds.length ? {flightId, competitionId: {notIn: matchIds}} : {flightId}
    });
    for (const competition of matches) {
      await tx.competitionEntry.upsert({
        where: {competitionId_flightId: {competitionId: competition.id, flightId}},
        create: {competitionId: competition.id, flightId, userId: flight.userId, score: competitionFlightScore(competition, flight)},
        update: {userId: flight.userId, score: competitionFlightScore(competition, flight)}
      });
    }
  });
  return matchIds;
}

export async function recalculateCompetitionFlights(competitionId: string) {
  const competition = await prisma.competition.findUnique({where: {id: competitionId}});
  if (!competition || competition.status !== "ACTIVE" || competition.endAt < new Date()) {
    await prisma.competitionEntry.deleteMany({where: {competitionId}});
    return 0;
  }
  const flights = await prisma.flight.findMany({
    where: {
      moderationStatus: "APPROVED",
      deletedAt: null,
      visibility: "PUBLIC",
      OR: [
        {startTime: {gte: competition.startAt, lte: competition.endAt}},
        {startTime: null, createdAt: {gte: competition.startAt, lte: competition.endAt}}
      ]
    },
    select: flightSelect
  });
  const matches = flights.filter((flight) => matchesCompetition(competition, flight));
  await prisma.$transaction(async (tx) => {
    await tx.competitionEntry.deleteMany({where: {competitionId}});
    if (matches.length) await tx.competitionEntry.createMany({
      data: matches.map((flight) => ({
        id: crypto.randomUUID(),
        competitionId,
        flightId: flight.id,
        userId: flight.userId,
        score: competitionFlightScore(competition, flight)
      }))
    });
  });
  return matches.length;
}
