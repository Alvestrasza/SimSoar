import crypto from "node:crypto";
import {prisma} from "@/lib/db";
import {leagueScore, recurringLeagueWindow} from "@/lib/league-policy";

const publicFlightWhere = {visibility: "PUBLIC", moderationStatus: "APPROVED", deletedAt: null} as const;
const flightSelect = {
  id: true, userId: true, startTime: true, createdAt: true, distanceKm: true, olcPoints: true,
  visibility: true, moderationStatus: true, deletedAt: true
} as const;

export async function ensureLeagueRounds(now = new Date()) {
  await prisma.leagueRound.updateMany({
    where: {status: "ACTIVE", endsAt: {lte: now}}, data: {status: "CLOSED", closedAt: now}
  });
  const leagues = await prisma.league.findMany({where: {active: true}});
  for (const league of leagues) {
    const window = recurringLeagueWindow(now, league);
    await prisma.leagueRound.updateMany({
      where: {leagueId: league.id, status: "ACTIVE", startsAt: {not: window.startsAt}},
      data: {status: "CLOSED", closedAt: now}
    });
    await prisma.leagueRound.upsert({
      where: {leagueId_startsAt: {leagueId: league.id, startsAt: window.startsAt}},
      create: {
        leagueId: league.id, startsAt: window.startsAt, endsAt: window.endsAt,
        status: window.contains ? "ACTIVE" : "CLOSED", closedAt: window.contains ? null : now
      },
      update: {endsAt: window.endsAt, status: window.contains ? "ACTIVE" : "CLOSED", closedAt: window.contains ? null : now}
    });
  }
}

async function eligibleForClub(clubId: string | null, userId: string) {
  if (!clubId) return false;
  return Boolean(await prisma.clubMembership.findUnique({where: {clubId_userId: {clubId, userId}}, select: {id: true}}));
}

export async function recalculateFlightLeagueEntries(flightId: string) {
  const flight = await prisma.flight.findUnique({where: {id: flightId}, select: flightSelect});
  await prisma.leagueRoundEntry.deleteMany({where: {flightId}});
  if (!flight || flight.visibility !== "PUBLIC" || flight.moderationStatus !== "APPROVED" || flight.deletedAt) return [];
  const leagues = await prisma.league.findMany({where: {active: true}});
  const flightDate = flight.startTime ?? flight.createdAt;
  const assigned: string[] = [];
  for (const league of leagues) {
    const window = recurringLeagueWindow(flightDate, league);
    if (!window.contains) continue;
    if (league.scope === "CLUB" && !await eligibleForClub(league.clubId, flight.userId)) continue;
    const now = new Date();
    const round = await prisma.leagueRound.upsert({
      where: {leagueId_startsAt: {leagueId: league.id, startsAt: window.startsAt}},
      create: {leagueId: league.id, startsAt: window.startsAt, endsAt: window.endsAt, status: window.endsAt <= now ? "CLOSED" : "ACTIVE", closedAt: window.endsAt <= now ? now : null},
      update: {endsAt: window.endsAt}
    });
    await prisma.leagueRoundEntry.create({
      data: {roundId: round.id, flightId, userId: flight.userId, score: leagueScore(league.scoringRule, flight)}
    });
    assigned.push(round.id);
  }
  return assigned;
}

export async function recalculateLeagueRound(roundId: string) {
  const round = await prisma.leagueRound.findUnique({where: {id: roundId}, include: {league: true}});
  if (!round) return 0;
  const flights = await prisma.flight.findMany({
    where: {
      ...publicFlightWhere,
      OR: [
        {startTime: {gte: round.startsAt, lt: round.endsAt}},
        {startTime: null, createdAt: {gte: round.startsAt, lt: round.endsAt}}
      ]
    }, select: flightSelect
  });
  const eligibleUserIds = round.league.scope === "CLUB"
    ? round.league.clubId
      ? new Set((await prisma.clubMembership.findMany({where: {clubId: round.league.clubId}, select: {userId: true}})).map((entry) => entry.userId))
      : new Set<string>()
    : null;
  const eligibleFlights = eligibleUserIds ? flights.filter((flight) => eligibleUserIds.has(flight.userId)) : flights;
  await prisma.$transaction(async (tx) => {
    await tx.leagueRoundEntry.deleteMany({where: {roundId}});
    if (eligibleFlights.length) await tx.leagueRoundEntry.createMany({data: eligibleFlights.map((flight) => ({
      id: crypto.randomUUID(), roundId, flightId: flight.id, userId: flight.userId,
      score: leagueScore(round.league.scoringRule, flight)
    }))});
  });
  return eligibleFlights.length;
}

export async function refreshLeague(leagueId: string) {
  const league = await prisma.league.findUnique({where: {id: leagueId}});
  if (!league) return 0;
  if (!league.active) {
    await prisma.leagueRound.updateMany({where: {leagueId, status: "ACTIVE"}, data: {status: "CLOSED", closedAt: new Date()}});
    return 0;
  }
  await ensureLeagueRounds();
  const round = await prisma.leagueRound.findFirst({where: {leagueId}, orderBy: {startsAt: "desc"}});
  return round ? recalculateLeagueRound(round.id) : 0;
}

export async function refreshClubLeagues(clubId: string) {
  const leagues = await prisma.league.findMany({where: {clubId, active: true}, select: {id: true}});
  for (const league of leagues) await refreshLeague(league.id);
}
