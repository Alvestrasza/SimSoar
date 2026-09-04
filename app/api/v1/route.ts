import {publicApiJson, publicApiRateLimitResponse} from "@/lib/public-api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const {rateLimit, response} = publicApiRateLimitResponse(request);
  if (response) return response;
  return publicApiJson({
    name: "SimSoar Public API",
    version: "v1",
    documentation: "https://github.com/Alvestrasza/SimSoar/blob/v0.4.0/docs/public-api.md",
    endpoints: {
      flights: "/api/v1/flights",
      flight: "/api/v1/flights/{id}",
      pilots: "/api/v1/pilots",
      rankings: "/api/v1/rankings"
    }
  }, {rateLimit});
}
