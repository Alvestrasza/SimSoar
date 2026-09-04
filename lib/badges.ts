import {prisma} from "@/lib/db";
import {evaluateBadgeCodes, type BadgeCode} from "@/lib/badge-policy";
export {pilotLevel} from "@/lib/badge-policy";

export async function recalculateUserBadges(userId: string) {
  const [flights, enabledDefinitions] = await Promise.all([
    prisma.flight.findMany({
      where: {userId, deletedAt: null, moderationStatus: "APPROVED"},
      select: {
        distanceKm: true,
        createdAt: true,
        thermals: {select: {maxClimbMs: true}}
      }
    }),
    prisma.badgeDefinition.findMany({where: {enabled: true}, select: {id: true, code: true}})
  ]);
  const evaluated = new Set(evaluateBadgeCodes(flights));
  const earnedBadgeIds = enabledDefinitions
    .filter((badge) => evaluated.has(badge.code as BadgeCode))
    .map((badge) => badge.id);

  await prisma.$transaction([
    prisma.userBadge.deleteMany({
      where: earnedBadgeIds.length > 0
        ? {userId, badgeId: {notIn: earnedBadgeIds}}
        : {userId}
    }),
    prisma.userBadge.createMany({
      data: earnedBadgeIds.map((badgeId) => ({userId, badgeId})),
      skipDuplicates: true
    })
  ]);
  return earnedBadgeIds;
}

export async function recalculateAllUserBadges() {
  const users = await prisma.user.findMany({select: {id: true}});
  for (let index = 0; index < users.length; index += 20) {
    await Promise.all(users.slice(index, index + 20).map((user) => recalculateUserBadges(user.id)));
  }
}
