"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {writeAuditLog} from "@/lib/audit";
import {normalizePublicSlug} from "@/lib/club-policy";
import {recalculateCompetitionFlights} from "@/lib/competitions";
import {EVIDENCE_FIELDS} from "@/lib/authenticity";

const competitionSchema = z.object({
  competitionId: z.string().optional(),
  name: z.string().trim().min(2).max(140),
  slug: z.string().trim().max(90).optional(),
  description: z.string().trim().max(3000).optional(),
  rules: z.string().trim().max(5000).optional(),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  status: z.enum(["DRAFT", "ACTIVE"]),
  scoringRule: z.enum(["OLC_POINTS", "DISTANCE"]),
  simulator: z.string().trim().max(80).optional(),
  competitionClass: z.string().trim().max(80).optional(),
  evidenceRequired: z.boolean(),
  requireSignedEvidence: z.boolean(),
  requiredTaskPackageId: z.string().trim().max(300).optional()
});

function safeLocale(value: FormDataEntryValue | null) { return value === "en" ? "en" : "de"; }
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "ADMIN")) throw new Error("Not authorized.");
  return session;
}
function refresh(locale: string, slug?: string) {
  revalidatePath(`/${locale}/competitions`);
  revalidatePath(`/${locale}/admin`);
  revalidatePath(`/${locale}/admin/competitions`);
  if (slug) revalidatePath(`/${locale}/competitions/${slug}`);
}

export async function saveCompetitionAction(formData: FormData) {
  const session = await requireAdmin();
  const locale = safeLocale(formData.get("locale"));
  const values = competitionSchema.parse({
    competitionId: String(formData.get("competitionId") ?? "") || undefined,
    name: formData.get("name"), slug: String(formData.get("slug") ?? "") || undefined,
    description: String(formData.get("description") ?? "") || undefined,
    rules: String(formData.get("rules") ?? "") || undefined,
    startAt: formData.get("startAt"), endAt: formData.get("endAt"), status: formData.get("status"),
    scoringRule: formData.get("scoringRule"), simulator: String(formData.get("simulator") ?? "") || undefined,
    competitionClass: String(formData.get("competitionClass") ?? "") || undefined,
    evidenceRequired: formData.get("evidenceRequired") === "true",
    requireSignedEvidence: formData.get("requireSignedEvidence") === "true",
    requiredTaskPackageId: String(formData.get("requiredTaskPackageId") ?? "") || undefined
  });
  const requiredEvidenceFields = [...new Set(formData.getAll("requiredEvidenceFields").map(String))];
  if (requiredEvidenceFields.some((field) => !(EVIDENCE_FIELDS as readonly string[]).includes(field))) redirect(`/${locale}/admin/competitions?error=evidence`);
  const evidenceSimulators = [...new Set(String(formData.get("evidenceSimulators") ?? "").split(/[,\r\n]+/).map((value) => value.trim()).filter(Boolean))].slice(0, 20);
  const startAt = new Date(values.startAt);
  const endAt = new Date(values.endAt);
  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || endAt <= startAt) {
    redirect(`/${locale}/admin/competitions?error=date`);
  }
  const slug = normalizePublicSlug(values.slug || values.name);
  if (!slug) redirect(`/${locale}/admin/competitions?error=slug`);
  const data = {
    name: values.name, slug, description: values.description || null, rules: values.rules || null,
    startAt, endAt, status: values.status, scoringRule: values.scoringRule,
    simulator: values.simulator || null, competitionClass: values.competitionClass || null,
    evidenceRequired: values.evidenceRequired, evidenceSimulators, requiredEvidenceFields,
    requireSignedEvidence: values.requireSignedEvidence, requiredTaskPackageId: values.requiredTaskPackageId || null,
    closedAt: null
  } as const;
  const competition = values.competitionId
    ? await prisma.competition.update({where: {id: values.competitionId}, data})
    : await prisma.competition.create({data});
  await recalculateCompetitionFlights(competition.id);
  await writeAuditLog({
    actorUserId: session.user.id, actorEmail: session.user.email,
    action: values.competitionId ? "COMPETITION_UPDATE" : "COMPETITION_CREATE",
    targetType: "Competition", targetId: competition.id,
    summary: values.competitionId ? "Competition settings were updated." : "A competition was created.",
    metadata: {name: competition.name, slug: competition.slug, status: competition.status}
  });
  refresh(locale, competition.slug);
  redirect(`/${locale}/admin/competitions?updated=1`);
}

export async function closeCompetitionAction(formData: FormData) {
  const session = await requireAdmin();
  const locale = safeLocale(formData.get("locale"));
  const competitionId = String(formData.get("competitionId") ?? "");
  const competition = await prisma.competition.update({
    where: {id: competitionId}, data: {status: "CLOSED", closedAt: new Date()}
  });
  await writeAuditLog({
    actorUserId: session.user.id, actorEmail: session.user.email, action: "COMPETITION_CLOSE",
    targetType: "Competition", targetId: competition.id, summary: "A competition was closed and archived.",
    metadata: {name: competition.name, slug: competition.slug}
  });
  refresh(locale, competition.slug);
  redirect(`/${locale}/admin/competitions?updated=1`);
}

export async function deleteCompetitionAction(formData: FormData) {
  const session = await requireAdmin();
  const locale = safeLocale(formData.get("locale"));
  const competitionId = String(formData.get("competitionId") ?? "");
  const competition = await prisma.competition.delete({where: {id: competitionId}});
  await writeAuditLog({
    actorUserId: session.user.id, actorEmail: session.user.email, action: "COMPETITION_DELETE",
    targetType: "Competition", targetId: competition.id, summary: "A competition was deleted.",
    metadata: {name: competition.name, slug: competition.slug}
  });
  refresh(locale, competition.slug);
  redirect(`/${locale}/admin/competitions?deleted=1`);
}
