"use server";

import {auth} from "@/auth";
import {writeAuditLog} from "@/lib/audit";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {calculateScore} from "@/lib/scoring";
import {revalidatePath} from "next/cache";
import {z} from "zod";

const scoringWindowSchema = z.object({
  flightId: z.string().min(1),
  locale: z.enum(["de", "en"]),
  mode: z.enum(["manual", "suggested"]),
  startSeq: z.coerce.number().int().nonnegative().optional(),
  endSeq: z.coerce.number().int().nonnegative().optional()
});

export async function updateScoringWindowAction(formData: FormData) {
  const fields = scoringWindowSchema.parse({
    flightId: formData.get("flightId"),
    locale: formData.get("locale"),
    mode: formData.get("mode"),
    startSeq: formData.get("startSeq") || undefined,
    endSeq: formData.get("endSeq") || undefined
  });
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated.");

  const flight = await prisma.flight.findUnique({
    where: {id: fields.flightId},
    include: {track: {orderBy: {seq: "asc"}}}
  });
  if (!flight) throw new Error("Flight not found.");
  if (flight.userId !== session.user.id && !hasRole(session.user.roles, "MODERATOR")) {
    throw new Error("Not authorized.");
  }
  if (flight.track.length < 2) throw new Error("Flight has insufficient track data.");

  const requestedStart = fields.mode === "suggested"
    ? flight.suggestedScoringStartSeq ?? flight.track[0].seq
    : fields.startSeq;
  const requestedEnd = fields.mode === "suggested"
    ? flight.suggestedScoringEndSeq ?? flight.track.at(-1)!.seq
    : fields.endSeq;
  if (requestedStart === undefined || requestedEnd === undefined || requestedStart >= requestedEnd) {
    throw new Error("Invalid scoring window.");
  }

  const windowTrack = flight.track.filter(
    (point) => point.seq >= requestedStart && point.seq <= requestedEnd
  );
  if (windowTrack.length < 2) throw new Error("Scoring window has insufficient track data.");

  const scoring = calculateScore(windowTrack);
  const actualStartSeq = windowTrack[0].seq;
  const actualEndSeq = windowTrack.at(-1)!.seq;

  await prisma.$transaction(async (tx) => {
    await tx.flightScoringPoint.deleteMany({where: {flightId: flight.id}});
    await tx.flight.update({
      where: {id: flight.id},
      data: {
        olcPoints: scoring.score,
        scoringRule: scoring.ruleId,
        scoringDistanceKm: scoring.distanceKm,
        scoringMultiplier: scoring.multiplier,
        scoringClosedCourse: scoring.isClosedCourse,
        scoringStartSeq: actualStartSeq,
        scoringEndSeq: actualEndSeq,
        scoringWindowMode: fields.mode === "suggested" ? "AUTO" : "MANUAL"
      }
    });
    await tx.flightScoringPoint.createMany({
      data: scoring.points.map((point) => ({
        flightId: flight.id,
        order: point.order,
        trackSeq: point.seq,
        lat: point.lat,
        lon: point.lon,
        legDistanceKm: point.legDistanceKm
      }))
    });
  });

  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "SCORING_WINDOW_UPDATE",
    targetType: "Flight",
    targetId: flight.id,
    summary: "Flight scoring window changed and score recalculated.",
    metadata: {
      previous: {
        startSeq: flight.scoringStartSeq,
        endSeq: flight.scoringEndSeq,
        mode: flight.scoringWindowMode,
        score: flight.olcPoints
      },
      current: {
        startSeq: actualStartSeq,
        endSeq: actualEndSeq,
        mode: fields.mode === "suggested" ? "AUTO" : "MANUAL",
        score: scoring.score,
        rule: scoring.ruleId
      }
    }
  });

  revalidatePath(`/${fields.locale}/flights/${flight.id}`);
}
