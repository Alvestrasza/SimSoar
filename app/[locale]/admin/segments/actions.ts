"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {writeAuditLog} from "@/lib/audit";
import {normalizePublicSlug} from "@/lib/club-policy";
import {recalculateSegmentFlights} from "@/lib/segments";

const schema = z.object({
  segmentId: z.string().optional(),
  name: z.string().trim().min(2).max(140),
  slug: z.string().trim().max(90).optional(),
  description: z.string().trim().max(3000).optional(),
  startLat: z.coerce.number().min(-90).max(90), startLon: z.coerce.number().min(-180).max(180),
  finishLat: z.coerce.number().min(-90).max(90), finishLon: z.coerce.number().min(-180).max(180),
  gateRadiusM: z.coerce.number().int().min(50).max(20_000), active: z.enum(["true", "false"])
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "ADMIN")) throw new Error("Not authorized.");
  return session;
}

export async function saveSegmentAction(formData: FormData) {
  const session = await requireAdmin();
  const locale = formData.get("locale") === "en" ? "en" : "de";
  const values = schema.parse({
    segmentId: String(formData.get("segmentId") ?? "") || undefined,
    name: formData.get("name"), slug: String(formData.get("slug") ?? "") || undefined,
    description: String(formData.get("description") ?? "") || undefined,
    startLat: formData.get("startLat"), startLon: formData.get("startLon"), finishLat: formData.get("finishLat"), finishLon: formData.get("finishLon"),
    gateRadiusM: formData.get("gateRadiusM"), active: formData.get("active")
  });
  const slug = normalizePublicSlug(values.slug || values.name);
  if (!slug) redirect(`/${locale}/admin/segments?error=slug`);
  const data = {
    name: values.name,
    slug,
    description: values.description || null,
    startLat: values.startLat,
    startLon: values.startLon,
    finishLat: values.finishLat,
    finishLon: values.finishLon,
    gateRadiusM: values.gateRadiusM,
    active: values.active === "true"
  };
  const segment = values.segmentId ? await prisma.flightSegment.update({where: {id: values.segmentId}, data}) : await prisma.flightSegment.create({data});
  await recalculateSegmentFlights(segment.id);
  await writeAuditLog({actorUserId: session.user.id, actorEmail: session.user.email, action: values.segmentId ? "SEGMENT_UPDATE" : "SEGMENT_CREATE", targetType: "FlightSegment", targetId: segment.id, summary: values.segmentId ? "A flight segment was updated." : "A flight segment was created.", metadata: {name: segment.name, slug: segment.slug, active: segment.active}});
  revalidatePath(`/${locale}/segments`); revalidatePath(`/${locale}/segments/${segment.slug}`); revalidatePath(`/${locale}/admin/segments`);
  redirect(`/${locale}/admin/segments?updated=1`);
}

export async function deleteSegmentAction(formData: FormData) {
  const session = await requireAdmin();
  const locale = formData.get("locale") === "en" ? "en" : "de";
  const segment = await prisma.flightSegment.delete({where: {id: String(formData.get("segmentId") ?? "")}});
  await writeAuditLog({actorUserId: session.user.id, actorEmail: session.user.email, action: "SEGMENT_DELETE", targetType: "FlightSegment", targetId: segment.id, summary: "A flight segment and its results were deleted.", metadata: {name: segment.name, slug: segment.slug}});
  revalidatePath(`/${locale}/segments`); revalidatePath(`/${locale}/admin/segments`);
  redirect(`/${locale}/admin/segments?deleted=1`);
}
