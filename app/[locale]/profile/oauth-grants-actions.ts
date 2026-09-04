"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {writeAuditLog} from "@/lib/audit";

export async function revokeOAuthGrantAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authorized.");
  const locale = formData.get("locale") === "en" ? "en" : "de";
  const grant = await prisma.oAuthGrant.findFirst({where: {id: String(formData.get("grantId") ?? ""), userId: session.user.id}, include: {client: {select: {clientId: true}}}});
  if (!grant) throw new Error("Not authorized.");
  await prisma.oAuthGrant.update({where: {id: grant.id}, data: {revokedAt: new Date()}});
  await writeAuditLog({actorUserId: session.user.id, actorEmail: session.user.email, action: "OAUTH_GRANT_REVOKE", targetType: "OAuthGrant", targetId: grant.id, summary: "A user revoked an OAuth integration grant.", metadata: {clientId: grant.client.clientId}});
  revalidatePath(`/${locale}/profile`);
  redirect(`/${locale}/profile?oauthRevoked=1`);
}
