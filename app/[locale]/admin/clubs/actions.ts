"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {writeAuditLog} from "@/lib/audit";
import {normalizeClubSlug} from "@/lib/club-policy";

const clubSchema = z.object({
  clubId: z.string().optional(),
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(2000).optional()
});

const membershipSchema = z.object({
  clubId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(["MEMBER", "MANAGER"])
});

function safeLocale(value: FormDataEntryValue | null) {
  return value === "en" ? "en" : "de";
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "ADMIN")) throw new Error("Not authorized.");
  return session;
}

function revalidateClubPages(locale: string, slug?: string) {
  revalidatePath(`/${locale}/clubs`);
  revalidatePath(`/${locale}/admin`);
  revalidatePath(`/${locale}/admin/clubs`);
  if (slug) revalidatePath(`/${locale}/clubs/${slug}`);
}

export async function saveClubAction(formData: FormData) {
  const session = await requireAdmin();
  const locale = safeLocale(formData.get("locale"));
  const values = clubSchema.parse({
    clubId: String(formData.get("clubId") ?? "") || undefined,
    name: formData.get("name"),
    slug: String(formData.get("slug") ?? "") || undefined,
    description: String(formData.get("description") ?? "") || undefined
  });
  const slug = normalizeClubSlug(values.slug || values.name);
  if (!slug) throw new Error("A valid club slug is required.");

  const club = values.clubId
    ? await prisma.club.update({
        where: {id: values.clubId},
        data: {name: values.name, slug, description: values.description || null}
      })
    : await prisma.club.create({
        data: {name: values.name, slug, description: values.description || null}
      });

  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: values.clubId ? "CLUB_UPDATE" : "CLUB_CREATE",
    targetType: "Club",
    targetId: club.id,
    summary: values.clubId ? "Club details were updated." : "A club was created.",
    metadata: {name: club.name, slug: club.slug}
  });
  revalidateClubPages(locale, club.slug);
  redirect(`/${locale}/admin/clubs?updated=1`);
}

export async function deleteClubAction(formData: FormData) {
  const session = await requireAdmin();
  const locale = safeLocale(formData.get("locale"));
  const clubId = String(formData.get("clubId") ?? "");
  const club = await prisma.club.delete({where: {id: clubId}});
  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "CLUB_DELETE",
    targetType: "Club",
    targetId: club.id,
    summary: "A club and its memberships were deleted.",
    metadata: {name: club.name, slug: club.slug}
  });
  revalidateClubPages(locale, club.slug);
  redirect(`/${locale}/admin/clubs?deleted=1`);
}

export async function assignClubMemberAction(formData: FormData) {
  const session = await requireAdmin();
  const locale = safeLocale(formData.get("locale"));
  const values = membershipSchema.parse({
    clubId: formData.get("clubId"),
    userId: formData.get("userId"),
    role: formData.get("role")
  });
  const membership = await prisma.clubMembership.upsert({
    where: {clubId_userId: {clubId: values.clubId, userId: values.userId}},
    create: values,
    update: {role: values.role},
    include: {club: {select: {slug: true}}}
  });
  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "CLUB_MEMBER_ASSIGN",
    targetType: "ClubMembership",
    targetId: membership.id,
    summary: "A user was assigned to a club.",
    metadata: {clubId: values.clubId, userId: values.userId, role: values.role}
  });
  revalidateClubPages(locale, membership.club.slug);
  redirect(`/${locale}/admin/clubs?updated=1`);
}

export async function removeClubMemberAction(formData: FormData) {
  const session = await requireAdmin();
  const locale = safeLocale(formData.get("locale"));
  const membershipId = String(formData.get("membershipId") ?? "");
  const membership = await prisma.clubMembership.delete({
    where: {id: membershipId},
    include: {club: {select: {slug: true}}}
  });
  await writeAuditLog({
    actorUserId: session.user.id,
    actorEmail: session.user.email,
    action: "CLUB_MEMBER_REMOVE",
    targetType: "ClubMembership",
    targetId: membership.id,
    summary: "A user was removed from a club.",
    metadata: {clubId: membership.clubId, userId: membership.userId}
  });
  revalidateClubPages(locale, membership.club.slug);
  redirect(`/${locale}/admin/clubs?updated=1`);
}
