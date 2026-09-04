import type {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";
import {writeAuditLog} from "@/lib/audit";
import {authenticateOAuthRequest, oauthApiError, oauthApiJson} from "@/lib/oauth-server";
import {hashIdempotentRequest, idempotencyDecision, OAuthPolicyError, validateIdempotencyKey} from "@/lib/oauth-policy";
import {CompanionUploadPolicyError, validateCompanionContentLength, validateCompanionFormShape, validateCompanionUploadFields, validateExplicitUploadConfirmation} from "@/lib/companion-upload-policy";
import {importCompanionFlight} from "@/lib/companion-flight-import";
import {sha256Buffer} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const {context, rateLimit} = await authenticateOAuthRequest(request, "flights.upload");
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) throw new CompanionUploadPolicyError("invalid_content_type");
    validateCompanionContentLength(request.headers.get("content-length"));
    const idempotencyKey = validateIdempotencyKey(request.headers.get("idempotency-key"));
    const formData = await request.formData();
    validateCompanionFormShape([...formData.keys()], formData.getAll("igc").length);
    const file = formData.get("igc");
    if (!(file instanceof File)) throw new CompanionUploadPolicyError("missing_file");
    const buffer = Buffer.from(await file.arrayBuffer());
    const sha256 = sha256Buffer(buffer);
    validateExplicitUploadConfirmation(request.headers.get("x-simsoar-upload-confirmation"), sha256);
    const fields = validateCompanionUploadFields(Object.fromEntries([...formData.entries()].filter(([key]) => key !== "igc")));
    const requestBodyFingerprint = JSON.stringify({sha256, fileName: file.name, fields});
    const requestHash = hashIdempotentRequest("POST", "/api/v1/flights/upload", context.userId, requestBodyFingerprint);
    const stored = await prisma.oAuthIdempotencyRecord.findUnique({where: {oauthClientId_userId_key: {oauthClientId: context.clientDbId, userId: context.userId, key: idempotencyKey}}});
    const decision = idempotencyDecision(stored, requestHash);
    if (decision.kind === "replay") return oauthApiJson(decision.body, {status: decision.status, rateLimit, replayed: true});
    const profile = await prisma.pilotProfile.findUnique({where: {userId: context.userId}, select: {callsign: true}});
    if (!profile?.callsign?.trim()) return oauthApiJson({error: {code: "pilot_profile_required", message: "A pilot profile callsign is required."}}, {status: 409, rateLimit});
    const imported = await importCompanionFlight({buffer, fileName: file.name, mimeType: file.type, userId: context.userId, pilotCallsign: profile.callsign.trim(), fields});
    const responseBody = {data: {id: imported.flight.id, sha256: imported.sha256, title: imported.flight.title, visibility: imported.flight.visibility, status: imported.flight.moderationStatus}};
    await prisma.oAuthIdempotencyRecord.create({data: {oauthClientId: context.clientDbId, userId: context.userId, key: idempotencyKey, requestHash, responseStatus: 201, responseBody: responseBody as unknown as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)}});
    await writeAuditLog({actorUserId: context.userId, actorEmail: context.userEmail, action: "OAUTH_API_WRITE", targetType: "Flight", targetId: imported.flight.id, summary: "A user-confirmed companion IGC upload was imported.", metadata: {clientId: context.clientId, sha256: imported.sha256, sizeBytes: buffer.length, simulator: fields.simulator, visibility: fields.visibility}});
    return oauthApiJson(responseBody, {status: 201, rateLimit});
  } catch (error) {
    if (error instanceof CompanionUploadPolicyError || error instanceof OAuthPolicyError && ["invalid_idempotency_key", "idempotency_key_reused"].includes(error.code)) {
      const status = error.code === "request_too_large" ? 413 : error.code === "duplicate" || error.code === "idempotency_key_reused" ? 409 : 400;
      return oauthApiJson({error: {code: error.code, message: "The confirmed IGC upload could not be accepted."}}, {status});
    }
    return oauthApiError(error, "flights.upload");
  }
}
