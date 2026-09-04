import type {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";
import {writeAuditLog} from "@/lib/audit";
import {authenticateOAuthRequest, oauthApiError, oauthApiJson} from "@/lib/oauth-server";
import {hashIdempotentRequest, idempotencyDecision, OAuthPolicyError, validateIdempotencyKey} from "@/lib/oauth-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, {params}: {params: Promise<{keyId: string}>}) {
  try {
    const {context, rateLimit} = await authenticateOAuthRequest(request, "flights.upload");
    const {keyId} = await params;
    if (!/^[A-Za-z0-9._:-]{8,120}$/.test(keyId)) throw new OAuthPolicyError("invalid_request");
    const idempotencyKey = validateIdempotencyKey(request.headers.get("idempotency-key"));
    const requestHash = hashIdempotentRequest("POST", `/api/v1/evidence/keys/${keyId}/revoke`, context.userId, "");
    const stored = await prisma.oAuthIdempotencyRecord.findUnique({where: {oauthClientId_userId_key: {oauthClientId: context.clientDbId, userId: context.userId, key: idempotencyKey}}});
    const decision = idempotencyDecision(stored, requestHash);
    if (decision.kind === "replay") return oauthApiJson(decision.body, {status: decision.status, rateLimit, replayed: true});
    const key = await prisma.authenticityKey.findUnique({where: {userId_oauthClientId_keyId: {userId: context.userId, oauthClientId: context.clientDbId, keyId}}});
    if (!key) return oauthApiJson({error: {code: "not_found", message: "Signing key not found."}}, {status: 404, rateLimit});
    const responseBody = {data: {keyId, fingerprint: key.fingerprint, active: false}};
    await prisma.$transaction(async (tx) => {
      if (!key.revokedAt) await tx.authenticityKey.update({where: {id: key.id}, data: {revokedAt: new Date()}});
      await tx.oAuthIdempotencyRecord.create({data: {oauthClientId: context.clientDbId, userId: context.userId, key: idempotencyKey, requestHash, responseStatus: 200, responseBody: responseBody as unknown as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)}});
    });
    if (!key.revokedAt) await writeAuditLog({actorUserId: context.userId, actorEmail: context.userEmail, action: "AUTHENTICITY_KEY_REVOKE", targetType: "AuthenticityKey", targetId: key.id, summary: "An evidence signing key was revoked.", metadata: {clientId: context.clientId, keyId, fingerprint: key.fingerprint}});
    return oauthApiJson(responseBody, {status: 200, rateLimit});
  } catch (error) {
    if (error instanceof OAuthPolicyError && ["invalid_request", "invalid_idempotency_key", "idempotency_key_reused"].includes(error.code)) return oauthApiJson({error: {code: error.code, message: "The request could not be accepted."}}, {status: error.code === "idempotency_key_reused" ? 409 : 400});
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "P2002") return oauthApiJson({error: {code: "concurrent_idempotency_request", message: "An identical request is being processed."}}, {status: 409});
    return oauthApiError(error, "flights.upload");
  }
}
