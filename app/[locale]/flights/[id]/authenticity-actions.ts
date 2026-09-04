"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {writeAuditLog} from "@/lib/audit";

const appealSchema = z.object({submissionId: z.string().min(1), text: z.string().trim().min(20).max(2000)});
const reviewSchema = z.object({submissionId: z.string().min(1), decision: z.enum(["ACCEPTED", "REJECTED"]), resolution: z.string().trim().min(10).max(2000)});
const localeFrom = (value: FormDataEntryValue | null) => value === "en" ? "en" : "de";

export async function appealAuthenticityAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authorized.");
  const locale = localeFrom(formData.get("locale"));
  const values = appealSchema.parse({submissionId: formData.get("submissionId"), text: formData.get("text")});
  const submission = await prisma.flightAuthenticitySubmission.findFirst({where: {id: values.submissionId, flight: {userId: session.user.id}}, select: {id: true, flightId: true, appealStatus: true}});
  if (!submission || submission.appealStatus === "OPEN") throw new Error("Not authorized.");
  await prisma.flightAuthenticitySubmission.update({where: {id: submission.id}, data: {appealStatus: "OPEN", appealText: values.text, appealedAt: new Date(), appealResolution: null, appealReviewedAt: null, appealReviewedByUserId: null}});
  await writeAuditLog({actorUserId: session.user.id, actorEmail: session.user.email, action: "AUTHENTICITY_APPEAL_CREATE", targetType: "FlightAuthenticitySubmission", targetId: submission.id, summary: "A flight authenticity appeal was submitted.", metadata: {flightId: submission.flightId}});
  revalidatePath(`/${locale}/flights/${submission.flightId}`);
  redirect(`/${locale}/flights/${submission.flightId}?appeal=created`);
}

export async function reviewAuthenticityAppealAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "MODERATOR")) throw new Error("Not authorized.");
  const locale = localeFrom(formData.get("locale"));
  const values = reviewSchema.parse({submissionId: formData.get("submissionId"), decision: formData.get("decision"), resolution: formData.get("resolution")});
  const submission = await prisma.flightAuthenticitySubmission.findFirst({where: {id: values.submissionId, appealStatus: "OPEN"}, select: {id: true, flightId: true}});
  if (!submission) throw new Error("Not authorized.");
  await prisma.flightAuthenticitySubmission.update({where: {id: submission.id}, data: {appealStatus: values.decision, appealResolution: values.resolution, appealReviewedAt: new Date(), appealReviewedByUserId: session.user.id}});
  await writeAuditLog({actorUserId: session.user.id, actorEmail: session.user.email, action: "AUTHENTICITY_APPEAL_REVIEW", targetType: "FlightAuthenticitySubmission", targetId: submission.id, summary: "A flight authenticity appeal was reviewed.", metadata: {flightId: submission.flightId, decision: values.decision}});
  revalidatePath(`/${locale}/flights/${submission.flightId}`);
  redirect(`/${locale}/flights/${submission.flightId}?appeal=reviewed`);
}
