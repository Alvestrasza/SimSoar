import {authenticateOAuthRequest, oauthApiError, oauthApiJson} from "@/lib/oauth-server";
import {prisma} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const {context, rateLimit} = await authenticateOAuthRequest(request, "profile.read");
    const user = await prisma.user.findUnique({where: {id: context.userId}, select: {id: true, name: true, profile: {select: {callsign: true, country: true}}}});
    return oauthApiJson({data: user, client: {id: context.clientId, scopes: context.scopes}}, {rateLimit});
  } catch (error) { return oauthApiError(error, "profile.read"); }
}
