"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {writeAuditLog} from "@/lib/audit";
import {normalizePublicSlug} from "@/lib/club-policy";
import {refreshLeague} from "@/lib/leagues";

const schema = z.object({
  leagueId: z.string().optional(), name: z.string().trim().min(2).max(140), slug: z.string().trim().max(90).optional(),
  description: z.string().trim().max(3000).optional(), mode: z.enum(["WEEKLY", "WEEKEND"]),
  scope: z.enum(["GLOBAL", "CLUB"]), clubId: z.string().optional(), startDayUtc: z.coerce.number().int().min(0).max(6),
  startHourUtc: z.coerce.number().int().min(0).max(23), durationHours: z.coerce.number().int().min(1).max(168),
  scoringRule: z.enum(["OLC_POINTS", "DISTANCE"]), active: z.enum(["true", "false"])
});
function localeOf(value: FormDataEntryValue | null) { return value === "en" ? "en" : "de"; }
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "ADMIN")) throw new Error("Not authorized.");
  return session;
}
function refreshPaths(locale: string, slug?: string) {
  revalidatePath(`/${locale}/leagues`); revalidatePath(`/${locale}/admin`); revalidatePath(`/${locale}/admin/leagues`);
  if (slug) revalidatePath(`/${locale}/leagues/${slug}`);
}

export async function saveLeagueAction(formData: FormData) {
  const session = await requireAdmin();
  const locale = localeOf(formData.get("locale"));
  const values = schema.parse({
    leagueId: String(formData.get("leagueId") ?? "") || undefined, name: formData.get("name"),
    slug: String(formData.get("slug") ?? "") || undefined, description: String(formData.get("description") ?? "") || undefined,
    mode: formData.get("mode"), scope: formData.get("scope"), clubId: String(formData.get("clubId") ?? "") || undefined,
    startDayUtc: formData.get("startDayUtc"), startHourUtc: formData.get("startHourUtc"), durationHours: formData.get("durationHours"),
    scoringRule: formData.get("scoringRule"), active: formData.get("active")
  });
  if (values.scope === "CLUB" && !values.clubId) redirect(`/${locale}/admin/leagues?error=club`);
  const slug = normalizePublicSlug(values.slug || values.name);
  if (!slug) redirect(`/${locale}/admin/leagues?error=slug`);
  const data = {
    name: values.name, slug, description: values.description || null, mode: values.mode, scope: values.scope,
    clubId: values.scope === "CLUB" ? values.clubId! : null, startDayUtc: values.startDayUtc,
    startHourUtc: values.startHourUtc, durationHours: values.durationHours, scoringRule: values.scoringRule,
    active: values.active === "true"
  } as const;
  const league = values.leagueId
    ? await prisma.league.update({where: {id: values.leagueId}, data})
    : await prisma.league.create({data});
  await refreshLeague(league.id);
  await writeAuditLog({
    actorUserId: session.user.id, actorEmail: session.user.email,
    action: values.leagueId ? "LEAGUE_UPDATE" : "LEAGUE_CREATE", targetType: "League", targetId: league.id,
    summary: values.leagueId ? "League settings were updated." : "A recurring league was created.",
    metadata: {name: league.name, slug: league.slug, mode: league.mode, scope: league.scope, active: league.active}
  });
  refreshPaths(locale, league.slug);
  redirect(`/${locale}/admin/leagues?updated=1`);
}

export async function deleteLeagueAction(formData: FormData) {
  const session = await requireAdmin();
  const locale = localeOf(formData.get("locale"));
  const league = await prisma.league.delete({where: {id: String(formData.get("leagueId") ?? "")}});
  await writeAuditLog({
    actorUserId: session.user.id, actorEmail: session.user.email, action: "LEAGUE_DELETE",
    targetType: "League", targetId: league.id, summary: "A recurring league and its rounds were deleted.",
    metadata: {name: league.name, slug: league.slug}
  });
  refreshPaths(locale, league.slug);
  redirect(`/${locale}/admin/leagues?deleted=1`);
}
