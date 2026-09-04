import {prisma} from "@/lib/db";
import {authenticateOAuthRequest, oauthApiError, oauthApiJson} from "@/lib/oauth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  try {
    const {context, rateLimit} = await authenticateOAuthRequest(request, "tasks.private.read");
    const {id} = await params;
    const task = await prisma.flightTask.findFirst({where: {id, ownerId: context.userId}, include: {waypoints: {orderBy: {seq: "asc"}}}});
    if (!task) return oauthApiJson({error: {code: "not_found", message: "Task not found."}}, {status: 404, rateLimit});
    return oauthApiJson({data: task}, {rateLimit});
  } catch (error) { return oauthApiError(error, "tasks.private.read"); }
}
