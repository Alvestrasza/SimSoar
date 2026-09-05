import "server-only";
import {cache} from "react";
import {Prisma} from "@prisma/client";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {JOURNAL_PAGE_SIZE, encodeJournalCursor, type JournalCursor, type JournalKind} from "@/lib/journal-policy";

export const getJournalOwner = cache(async () => {
  const session = await auth();
  return session?.user?.id ? {id: session.user.id} : null;
});

export type JournalActivity = {
  key: string;
  kind: JournalKind;
  happenedAt: Date;
  title: string;
  body: string | null;
  href: string | null;
};

function pageSource(source: Prisma.Sql, cursor: JournalCursor | null) {
  const boundary = cursor ? Prisma.sql`WHERE "happenedAt" < ${new Date(cursor.at)} OR ("happenedAt" = ${new Date(cursor.at)} AND "key" COLLATE "C" < ${cursor.key})` : Prisma.empty;
  return Prisma.sql`(SELECT * FROM (${source}) AS source ${boundary} ORDER BY "happenedAt" DESC, "key" COLLATE "C" DESC LIMIT ${JOURNAL_PAGE_SIZE + 1})`;
}

export async function getJournalTimeline(cursor: JournalCursor | null) {
  const owner = await getJournalOwner();
  if (!owner) throw new Error("not_authenticated");
  const userId = owner.id;
  // Only existing, user-visible domain records are projected. Security/audit
  // records are deliberately absent from this personal activity timeline.
  const visibleRelatedFlight = Prisma.sql`f."deletedAt" IS NULL AND (f."userId" = ${userId} OR (f."visibility" = 'PUBLIC' AND f."moderationStatus" = 'APPROVED'))`;
  const sources = [
    Prisma.sql`SELECT 'entry:' || e."id" AS "key", 'entry'::text AS kind, e."occurredAt" AS "happenedAt", e."title", e."body", NULL::text AS href FROM "JournalEntry" e WHERE e."userId" = ${userId}`,
    Prisma.sql`SELECT 'flight:' || f."id" AS "key", 'flight'::text AS kind, f."createdAt" AS "happenedAt", f."title", f."simulator" AS body, '/flights/' || f."id" AS href FROM "Flight" f WHERE f."userId" = ${userId} AND f."deletedAt" IS NULL`,
    Prisma.sql`SELECT 'task:' || t."id" AS "key", 'task'::text AS kind, t."createdAt" AS "happenedAt", t."name" AS title, NULL::text AS body, '/tasks/' || t."id" AS href FROM "FlightTask" t WHERE t."ownerId" = ${userId}`,
    Prisma.sql`SELECT 'club:' || m."id" AS "key", 'club'::text AS kind, m."joinedAt" AS "happenedAt", c."name" AS title, NULL::text AS body, '/clubs/' || c."slug" AS href FROM "ClubMembership" m JOIN "Club" c ON c."id" = m."clubId" WHERE m."userId" = ${userId}`,
    Prisma.sql`SELECT 'competition:' || e."id" AS "key", 'competition'::text AS kind, e."assignedAt" AS "happenedAt", c."name" AS title, f."title" AS body, '/competitions/' || c."slug" AS href FROM "CompetitionEntry" e JOIN "Competition" c ON c."id" = e."competitionId" JOIN "Flight" f ON f."id" = e."flightId" WHERE e."userId" = ${userId} AND f."userId" = ${userId} AND f."deletedAt" IS NULL`,
    Prisma.sql`SELECT 'league:' || e."id" AS "key", 'league'::text AS kind, e."createdAt" AS "happenedAt", l."name" AS title, f."title" AS body, '/leagues/' || l."slug" AS href FROM "LeagueRoundEntry" e JOIN "LeagueRound" r ON r."id" = e."roundId" JOIN "League" l ON l."id" = r."leagueId" JOIN "Flight" f ON f."id" = e."flightId" WHERE e."userId" = ${userId} AND f."userId" = ${userId} AND f."deletedAt" IS NULL`,
    Prisma.sql`SELECT 'follow:' || p."id" AS "key", 'follow'::text AS kind, p."createdAt" AS "happenedAt", COALESCE(profile."callsign", 'Pilot') AS title, NULL::text AS body, '/pilots/' || p."followingId" AS href FROM "PilotFollow" p LEFT JOIN "PilotProfile" profile ON profile."userId" = p."followingId" WHERE p."followerId" = ${userId}`,
    Prisma.sql`SELECT 'badge:' || b."id" AS "key", 'badge'::text AS kind, b."awardedAt" AS "happenedAt", d."name" AS title, NULL::text AS body, '/profile'::text AS href FROM "UserBadge" b JOIN "BadgeDefinition" d ON d."id" = b."badgeId" WHERE b."userId" = ${userId} AND d."enabled" = true`,
    Prisma.sql`SELECT 'comment:' || c."id" AS "key", 'comment'::text AS kind, c."createdAt" AS "happenedAt", f."title", LEFT(c."content", 500) AS body, '/flights/' || f."id" AS href FROM "FlightComment" c JOIN "Flight" f ON f."id" = c."flightId" WHERE c."userId" = ${userId} AND c."deletedAt" IS NULL AND ${visibleRelatedFlight}`,
    Prisma.sql`SELECT 'like:' || l."id" AS "key", 'like'::text AS kind, l."createdAt" AS "happenedAt", f."title", NULL::text AS body, '/flights/' || f."id" AS href FROM "FlightLike" l JOIN "Flight" f ON f."id" = l."flightId" WHERE l."userId" = ${userId} AND ${visibleRelatedFlight}`,
    Prisma.sql`SELECT 'cup:' || c."id" AS "key", 'cup'::text AS kind, c."createdAt" AS "happenedAt", c."sourceName" AS title, NULL::text AS body, '/tasks'::text AS href FROM "CupImport" c WHERE c."ownerId" = ${userId}`,
    Prisma.sql`SELECT 'segment:' || r."id" AS "key", 'segment'::text AS kind, r."createdAt" AS "happenedAt", s."name" AS title, f."title" AS body, '/flights/' || f."id" AS href FROM "FlightSegmentResult" r JOIN "FlightSegment" s ON s."id" = r."segmentId" JOIN "Flight" f ON f."id" = r."flightId" WHERE r."userId" = ${userId} AND f."userId" = ${userId} AND f."deletedAt" IS NULL`
  ];
  const rows = await prisma.$queryRaw<JournalActivity[]>(Prisma.sql`
    SELECT * FROM (${Prisma.join(sources.map((source) => pageSource(source, cursor)), " UNION ALL ")}) AS activity
    ORDER BY "happenedAt" DESC, "key" COLLATE "C" DESC LIMIT ${JOURNAL_PAGE_SIZE + 1}
  `);
  const items = rows.slice(0, JOURNAL_PAGE_SIZE);
  const entryIds = items.filter((item) => item.kind === "entry").map((item) => item.key.slice(6));
  const entries = entryIds.length ? await prisma.journalEntry.findMany({
    where: {id: {in: entryIds}, userId},
    select: {id: true, images: {orderBy: [{createdAt: "asc"}, {id: "asc"}], select: {id: true, width: true, height: true}}}
  }) : [];
  return {items, entries, nextCursor: rows.length > JOURNAL_PAGE_SIZE && items.length ? encodeJournalCursor(items[items.length - 1]) : null};
}
