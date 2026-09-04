"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {auth} from "@/auth";
import {prisma} from "@/lib/db";
import {hasRole} from "@/lib/rbac";
import {normalizeOAuthScopes, normalizeRedirectUris, OAuthPolicyError, SIMSOAR_OAUTH_SCOPES} from "@/lib/oauth-policy";
import {writeAuditLog} from "@/lib/audit";

const schema = z.object({
  recordId: z.string().optional(),
  clientId: z.string().trim().regex(/^[A-Za-z0-9._:-]{3,160}$/),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(["PENDING", "APPROVED", "SUSPENDED", "REVOKED"]),
  consentRequired: z.literal("true")
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || !hasRole(session.user.roles, "ADMIN")) throw new Error("Not authorized.");
  return session;
}

export async function saveOAuthClientAction(formData: FormData) {
  const session = await requireAdmin();
  const locale = formData.get("locale") === "en" ? "en" : "de";
  let values: z.infer<typeof schema>;
  let redirectUris: string[];
  try {
    values = schema.parse({recordId: String(formData.get("recordId") ?? "") || undefined, clientId: formData.get("clientId"), name: formData.get("name"), description: String(formData.get("description") ?? "") || undefined, status: formData.get("status"), consentRequired: formData.get("consentRequired")});
    redirectUris = normalizeRedirectUris(String(formData.get("redirectUris") ?? ""));
  } catch (error) {
    const code = error instanceof OAuthPolicyError ? error.code : "invalid_client";
    redirect(`/${locale}/admin/oauth-clients?error=${encodeURIComponent(code)}`);
  }
  const scopes = normalizeOAuthScopes(formData.getAll("scopes").map(String));
  if (!scopes.length || formData.getAll("scopes").some((scope) => !SIMSOAR_OAUTH_SCOPES.includes(String(scope) as never))) redirect(`/${locale}/admin/oauth-clients?error=invalid_scopes`);
  const previous = values.recordId ? await prisma.oAuthClient.findUnique({where: {id: values.recordId}, select: {status: true, clientId: true}}) : null;
  if (values.recordId && (!previous || previous.clientId !== values.clientId)) redirect(`/${locale}/admin/oauth-clients?error=immutable_client_id`);
  const review = values.status === "PENDING" ? {reviewedByUserId: null, reviewedAt: null} : {reviewedByUserId: session.user.id, reviewedAt: new Date()};
  const data = {clientId: values.clientId, name: values.name, description: values.description || null, redirectUris, allowedScopes: scopes, status: values.status, consentRequired: true, ...review};
  const client = values.recordId
    ? await prisma.oAuthClient.update({where: {id: values.recordId}, data})
    : await prisma.oAuthClient.create({data: {...data, registeredByUserId: session.user.id}});
  const action = !values.recordId ? "OAUTH_CLIENT_CREATE" : values.status === "REVOKED" && previous?.status !== "REVOKED" ? "OAUTH_CLIENT_REVOKE" : "OAUTH_CLIENT_UPDATE";
  await writeAuditLog({actorUserId: session.user.id, actorEmail: session.user.email, action, targetType: "OAuthClient", targetId: client.id, summary: !values.recordId ? "An OAuth client registration was created." : "An OAuth client registration was reviewed or updated.", metadata: {clientId: client.clientId, status: client.status, scopes: client.allowedScopes, redirectUriCount: client.redirectUris.length}});
  revalidatePath(`/${locale}/admin/oauth-clients`);
  redirect(`/${locale}/admin/oauth-clients?saved=1`);
}
