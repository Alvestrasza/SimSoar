"use server";

import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {recalculateAllUserBadges} from "@/lib/badges";
import {writeAuditLog} from "@/lib/audit";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";

export async function updateBadgeStateAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "ADMIN")) throw new Error("Not authorized.");
  const locale = formData.get("locale") === "en" ? "en" : "de";
  const badgeId = String(formData.get("badgeId") ?? "");
  const enabled = formData.get("enabled") === "true";
  const badge = await prisma.badgeDefinition.update({where: {id: badgeId}, data: {enabled}});
  if (enabled) await recalculateAllUserBadges();
  else await prisma.userBadge.deleteMany({where: {badgeId}});
  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "BADGE_SETTINGS_UPDATE",
    targetType: "BadgeDefinition",
    targetId: badge.id,
    summary: `Badge ${enabled ? "enabled" : "disabled"}.`,
    metadata: {code: badge.code, enabled}
  });
  revalidatePath(`/${locale}/admin/badges`);
  redirect(`/${locale}/admin/badges?updated=1`);
}
