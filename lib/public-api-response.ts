import {NextResponse} from "next/server";
import {consumePublicApiRateLimit, rateLimitHeaders, type RateLimitResult} from "@/lib/public-api";

export function publicApiJson(body: unknown, options: {status?: number; rateLimit?: RateLimitResult} = {}) {
  return NextResponse.json(body, {
    status: options.status ?? 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      ...rateLimitHeaders(options.rateLimit)
    }
  });
}

export function publicApiRateLimitResponse(request: Request) {
  const rateLimit = consumePublicApiRateLimit(request);
  return rateLimit.allowed
    ? {rateLimit, response: null}
    : {rateLimit, response: publicApiJson({error: {code: "rate_limit_exceeded", message: "Too many requests."}}, {status: 429, rateLimit})};
}
