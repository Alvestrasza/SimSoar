import type {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";
import {writeAuditLog} from "@/lib/audit";
import {authenticateOAuthRequest, oauthApiError, oauthApiJson} from "@/lib/oauth-server";
import {hashIdempotentRequest, idempotencyDecision, OAuthPolicyError, validateIdempotencyKey} from "@/lib/oauth-policy";
import {normalizeTaskPoints, taskDistanceKm, type TaskPoint} from "@/lib/task-planner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const taskSelect = {id: true, lineageId: true, revision: true, name: true, description: true, visibility: true, totalDistanceKm: true, createdAt: true, updatedAt: true, waypoints: {orderBy: {seq: "asc" as const}, select: {seq: true, name: true, code: true, lat: true, lon: true, radiusM: true}}};

export async function GET(request: Request) {
  try {
    const {context, rateLimit} = await authenticateOAuthRequest(request, "tasks.private.read");
    const tasks = await prisma.flightTask.findMany({where: {ownerId: context.userId}, orderBy: {updatedAt: "desc"}, take: 100, select: taskSelect});
    return oauthApiJson({data: tasks}, {rateLimit});
  } catch (error) { return oauthApiError(error, "tasks.private.read"); }
}

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new OAuthPolicyError("invalid_content_type");
    const {context, rateLimit} = await authenticateOAuthRequest(request, "tasks.write");
    const key = validateIdempotencyKey(request.headers.get("idempotency-key"));
    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (declaredLength > 100_000) throw new OAuthPolicyError("request_too_large");
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > 100_000) throw new OAuthPolicyError("request_too_large");
    const requestHash = hashIdempotentRequest("POST", "/api/v1/tasks", context.userId, text);
    const existing = await prisma.oAuthIdempotencyRecord.findUnique({where: {oauthClientId_userId_key: {oauthClientId: context.clientDbId, userId: context.userId, key}}});
    const decision = idempotencyDecision(existing, requestHash);
    if (decision.kind === "replay") return oauthApiJson(decision.body, {status: decision.status, rateLimit, replayed: true});
    let input: unknown;
    try { input = JSON.parse(text); } catch { throw new OAuthPolicyError("invalid_request"); }
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new OAuthPolicyError("invalid_request");
    const body = input as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const visibility = body.visibility;
    if (name.length < 2 || name.length > 120 || description.length > 2000 || !["PUBLIC", "UNLISTED", "PRIVATE"].includes(String(visibility)) || !Array.isArray(body.waypoints)) throw new OAuthPolicyError("invalid_request");
    let waypoints: ReturnType<typeof normalizeTaskPoints>;
    try { waypoints = normalizeTaskPoints(body.waypoints as TaskPoint[]); } catch { throw new OAuthPolicyError("invalid_request"); }
    const responseBody = await prisma.$transaction(async (tx) => {
      const task = await tx.flightTask.create({data: {ownerId: context.userId, name, description: description || null, visibility: visibility as "PUBLIC" | "UNLISTED" | "PRIVATE", totalDistanceKm: taskDistanceKm(waypoints), waypoints: {createMany: {data: waypoints}}}, select: taskSelect});
      const result = {data: task};
      await tx.oAuthIdempotencyRecord.create({data: {oauthClientId: context.clientDbId, userId: context.userId, key, requestHash, responseStatus: 201, responseBody: result as unknown as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)}});
      return result;
    });
    await writeAuditLog({actorUserId: context.userId, actorEmail: context.userEmail, action: "OAUTH_API_WRITE", targetType: "FlightTask", targetId: responseBody.data.id, summary: "A task was created through the OAuth API.", metadata: {clientId: context.clientId, scopes: context.scopes}});
    return oauthApiJson(responseBody, {status: 201, rateLimit});
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "P2002") return oauthApiJson({error: {code: "concurrent_idempotency_request", message: "An identical idempotent request is still being processed."}}, {status: 409});
    if (error instanceof OAuthPolicyError && ["invalid_content_type", "request_too_large", "invalid_request", "invalid_idempotency_key", "idempotency_key_reused"].includes(error.code)) return oauthApiJson({error: {code: error.code, message: "The request could not be accepted."}}, {status: error.code === "idempotency_key_reused" ? 409 : error.code === "request_too_large" ? 413 : 400});
    return oauthApiError(error, "tasks.write");
  }
}
