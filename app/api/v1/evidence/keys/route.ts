import type {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";
import {writeAuditLog} from "@/lib/audit";
import {authenticateOAuthRequest, oauthApiError, oauthApiJson} from "@/lib/oauth-server";
import {hashIdempotentRequest, idempotencyDecision, OAuthPolicyError, validateIdempotencyKey} from "@/lib/oauth-policy";
import {AuthenticityError, publicKeyFingerprint, validateEd25519PublicJwk} from "@/lib/authenticity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new OAuthPolicyError("invalid_content_type");
    const {context, rateLimit} = await authenticateOAuthRequest(request, "flights.upload");
    const idempotencyKey = validateIdempotencyKey(request.headers.get("idempotency-key"));
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > 10_000) throw new OAuthPolicyError("request_too_large");
    const requestHash = hashIdempotentRequest("POST", "/api/v1/evidence/keys", context.userId, text);
    const stored = await prisma.oAuthIdempotencyRecord.findUnique({where: {oauthClientId_userId_key: {oauthClientId: context.clientDbId, userId: context.userId, key: idempotencyKey}}});
    const decision = idempotencyDecision(stored, requestHash);
    if (decision.kind === "replay") return oauthApiJson(decision.body, {status: decision.status, rateLimit, replayed: true});
    let input: unknown;
    try { input = JSON.parse(text); } catch { throw new OAuthPolicyError("invalid_request"); }
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !["keyId", "publicKeyJwk"].includes(key))) throw new OAuthPolicyError("invalid_request");
    const body = input as Record<string, unknown>;
    if (typeof body.keyId !== "string" || !/^[A-Za-z0-9._:-]{8,120}$/.test(body.keyId)) throw new OAuthPolicyError("invalid_request");
    const publicKeyJwk = validateEd25519PublicJwk(body.publicKeyJwk);
    const fingerprint = publicKeyFingerprint(publicKeyJwk);
    const existing = await prisma.authenticityKey.findUnique({where: {userId_oauthClientId_keyId: {userId: context.userId, oauthClientId: context.clientDbId, keyId: body.keyId}}});
    if (existing && (existing.fingerprint !== fingerprint || existing.revokedAt)) return oauthApiJson({error: {code: "key_id_conflict", message: "The key ID cannot be reused."}}, {status: 409, rateLimit});
    const responseStatus = existing ? 200 : 201;
    const responseBody = {data: {keyId: body.keyId, fingerprint, algorithm: "Ed25519", active: true}};
    await prisma.$transaction(async (tx) => {
      if (!existing) await tx.authenticityKey.create({data: {userId: context.userId, oauthClientId: context.clientDbId, keyId: body.keyId as string, publicKeyJwk, fingerprint}});
      await tx.oAuthIdempotencyRecord.create({data: {oauthClientId: context.clientDbId, userId: context.userId, key: idempotencyKey, requestHash, responseStatus, responseBody: responseBody as unknown as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)}});
    });
    if (!existing) await writeAuditLog({actorUserId: context.userId, actorEmail: context.userEmail, action: "AUTHENTICITY_KEY_REGISTER", targetType: "AuthenticityKey", targetId: fingerprint, summary: "An evidence signing key was registered.", metadata: {clientId: context.clientId, keyId: body.keyId, fingerprint}});
    return oauthApiJson(responseBody, {status: responseStatus, rateLimit});
  } catch (error) {
    if (error instanceof AuthenticityError || error instanceof OAuthPolicyError && ["invalid_content_type", "request_too_large", "invalid_request", "invalid_idempotency_key", "idempotency_key_reused"].includes(error.code)) return oauthApiJson({error: {code: error.code, message: "The request could not be accepted."}}, {status: error.code === "idempotency_key_reused" ? 409 : error.code === "request_too_large" ? 413 : 400});
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "P2002") return oauthApiJson({error: {code: "concurrent_idempotency_request", message: "An identical request is being processed."}}, {status: 409});
    return oauthApiError(error, "flights.upload");
  }
}
