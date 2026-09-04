import type {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";
import {writeAuditLog} from "@/lib/audit";
import {authenticateOAuthRequest, oauthApiError, oauthApiJson} from "@/lib/oauth-server";
import {hashIdempotentRequest, idempotencyDecision, OAuthPolicyError, validateIdempotencyKey} from "@/lib/oauth-policy";
import {AuthenticityError, boundedEvidenceSummary, evaluateFlightEvidence, evidenceSha256, parseFlightEvidence, verifyEvidenceSignature} from "@/lib/authenticity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
  try {
    const {context, rateLimit} = await authenticateOAuthRequest(request, "flights.upload");
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new OAuthPolicyError("invalid_content_type");
    const {id} = await params;
    const idempotencyKey = validateIdempotencyKey(request.headers.get("idempotency-key"));
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > 32_000) throw new OAuthPolicyError("request_too_large");
    const requestHash = hashIdempotentRequest("POST", `/api/v1/flights/${id}/evidence`, context.userId, text);
    const stored = await prisma.oAuthIdempotencyRecord.findUnique({where: {oauthClientId_userId_key: {oauthClientId: context.clientDbId, userId: context.userId, key: idempotencyKey}}});
    const decision = idempotencyDecision(stored, requestHash);
    if (decision.kind === "replay") return oauthApiJson(decision.body, {status: decision.status, rateLimit, replayed: true});
    let input: unknown;
    try { input = JSON.parse(text); } catch { throw new OAuthPolicyError("invalid_request"); }
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !["evidence", "keyId", "signature"].includes(key))) throw new OAuthPolicyError("invalid_request");
    const body = input as Record<string, unknown>;
    const evidence = parseFlightEvidence(body.evidence);
    const keyId = typeof body.keyId === "string" && /^[A-Za-z0-9._:-]{8,120}$/.test(body.keyId) ? body.keyId : null;
    const signature = typeof body.signature === "string" ? body.signature : null;
    if (Boolean(keyId) !== Boolean(signature)) throw new OAuthPolicyError("invalid_request");
    const flight = await prisma.flight.findFirst({where: {id, userId: context.userId}, select: {id: true, igcSha256: true, simulator: true, glider: true, weatherMode: true, startTime: true, durationSeconds: true, competitionEntries: {select: {competition: {select: {id: true, evidenceRequired: true, evidenceSimulators: true, requiredEvidenceFields: true, requireSignedEvidence: true, requiredTaskPackageId: true}}}}}});
    if (!flight) return oauthApiJson({error: {code: "not_found", message: "Flight not found."}}, {status: 404, rateLimit});
    const key = keyId ? await prisma.authenticityKey.findUnique({where: {userId_oauthClientId_keyId: {userId: context.userId, oauthClientId: context.clientDbId, keyId}}}) : null;
    const signatureValid = Boolean(signature && key && !key.revokedAt && verifyEvidenceSignature(evidence, signature, key.publicKeyJwk));
    const duplicateAttempt = evidence.attemptId ? Boolean(await prisma.flightAuthenticitySubmission.findFirst({where: {userId: context.userId, attemptId: evidence.attemptId, flightId: {not: flight.id}}, select: {id: true}})) : false;
    const evaluation = evaluateFlightEvidence({evidence, flight, signature: {present: Boolean(signature), valid: signatureValid}, duplicateAttempt, competitions: flight.competitionEntries.map((entry) => entry.competition)});
    const aggregate = await prisma.flightAuthenticitySubmission.aggregate({where: {flightId: flight.id}, _max: {revision: true}});
    const revision = (aggregate._max.revision ?? 0) + 1;
    const responseBody = {data: {flightId: flight.id, revision, status: evaluation.status, signed: Boolean(signature), signatureValid: signature ? signatureValid : null, findings: evaluation.findings}};
    const submission = await prisma.$transaction(async (tx) => {
      const created = await tx.flightAuthenticitySubmission.create({data: {flightId: flight.id, userId: context.userId, oauthClientId: context.clientDbId, revision, status: evaluation.status, evidenceVersion: evidence.version, evidenceSha256: evidenceSha256(evidence), simulatorVersion: evidence.simulatorVersion, taskPackageId: evidence.taskPackageId, taskPackageSha256: evidence.taskPackageSha256, attemptId: evidence.attemptId, signed: Boolean(signature), signatureValid: signature ? signatureValid : null, signingKeyId: keyId, evidenceSummary: boundedEvidenceSummary(evidence), findings: evaluation.findings as unknown as Prisma.InputJsonValue}});
      await tx.oAuthIdempotencyRecord.create({data: {oauthClientId: context.clientDbId, userId: context.userId, key: idempotencyKey, requestHash, responseStatus: 201, responseBody: responseBody as unknown as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)}});
      return created;
    });
    await writeAuditLog({actorUserId: context.userId, actorEmail: context.userEmail, action: "AUTHENTICITY_EVIDENCE_SUBMIT", targetType: "FlightAuthenticitySubmission", targetId: submission.id, summary: "A bounded flight evidence summary was submitted.", metadata: {clientId: context.clientId, flightId: flight.id, revision, status: evaluation.status, findingCodes: evaluation.findings.map((finding) => finding.code)}});
    return oauthApiJson(responseBody, {status: 201, rateLimit});
  } catch (error) {
    if (error instanceof AuthenticityError || error instanceof OAuthPolicyError && ["invalid_content_type", "request_too_large", "invalid_request", "invalid_idempotency_key", "idempotency_key_reused"].includes(error.code)) return oauthApiJson({error: {code: error.code, message: "The request could not be accepted."}}, {status: error.code === "idempotency_key_reused" ? 409 : error.code === "request_too_large" ? 413 : 400});
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "P2002") return oauthApiJson({error: {code: "concurrent_submission", message: "An identical request is being processed."}}, {status: 409});
    return oauthApiError(error, "flights.upload");
  }
}
