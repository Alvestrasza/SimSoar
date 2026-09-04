export const PUBLIC_FLIGHT_WHERE = {
  visibility: "PUBLIC",
  moderationStatus: "APPROVED",
  deletedAt: null
} as const;

export const PUBLIC_API_MAX_PAGE_SIZE = 100;

export function parsePublicApiPagination(searchParams: URLSearchParams) {
  const requestedLimit = Number.parseInt(searchParams.get("limit") ?? "25", 10);
  const requestedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(PUBLIC_API_MAX_PAGE_SIZE, Math.max(1, requestedLimit)) : 25;
  const page = Number.isFinite(requestedPage) ? Math.min(10_000, Math.max(1, requestedPage)) : 1;
  return {limit, page, skip: (page - 1) * limit};
}

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtSeconds: number;
  retryAfterSeconds: number;
};

export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, {windowStartMs: number; count: number}>();
  readonly limit: number;
  readonly windowMs: number;
  private readonly maximumKeys: number;

  constructor(limit: number, windowMs: number, maximumKeys = 10_000) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.maximumKeys = maximumKeys;
  }

  consume(key: string, nowMs = Date.now()): RateLimitResult {
    const existing = this.entries.get(key);
    const windowStartMs = existing && nowMs - existing.windowStartMs < this.windowMs ? existing.windowStartMs : nowMs;
    const count = existing && windowStartMs === existing.windowStartMs ? existing.count + 1 : 1;
    this.entries.set(key, {windowStartMs, count});
    if (this.entries.size > this.maximumKeys) this.prune(nowMs);
    const resetAtMs = windowStartMs + this.windowMs;
    return {
      allowed: count <= this.limit,
      limit: this.limit,
      remaining: Math.max(0, this.limit - count),
      resetAtSeconds: Math.ceil(resetAtMs / 1000),
      retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000))
    };
  }

  private prune(nowMs: number) {
    for (const [key, entry] of this.entries) {
      if (nowMs - entry.windowStartMs >= this.windowMs || this.entries.size > this.maximumKeys) this.entries.delete(key);
      if (this.entries.size <= this.maximumKeys) break;
    }
  }
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

const globalRateLimit = globalThis as typeof globalThis & {simSoarPublicApiRateLimiter?: FixedWindowRateLimiter};
const configuredLimit = boundedInteger(process.env.PUBLIC_API_RATE_LIMIT, 120, 10, 10_000);
const configuredWindowSeconds = boundedInteger(process.env.PUBLIC_API_RATE_WINDOW_SECONDS, 60, 1, 3600);
const publicApiRateLimiter = globalRateLimit.simSoarPublicApiRateLimiter ??= new FixedWindowRateLimiter(configuredLimit, configuredWindowSeconds * 1000);

function clientKey(request: Request) {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return forwarded || "unknown-client";
}

export function consumePublicApiRateLimit(request: Request) {
  return publicApiRateLimiter.consume(clientKey(request));
}

export function rateLimitHeaders(rateLimit?: RateLimitResult) {
  return rateLimit ? {
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(rateLimit.resetAtSeconds),
    ...(rateLimit.allowed ? {} : {"Retry-After": String(rateLimit.retryAfterSeconds)})
  } : {};
}

export function publicFlightSummary<T extends {
  id: string; title: string; pilotCallsign: string; simulator: string; glider: string | null;
  competitionClass: string | null; startTime: Date | null; durationSeconds: number; distanceKm: number;
  olcPoints: number; avgSpeedKmh: number; maxAltitudeM: number; maxVarioMs: number; createdAt: Date; updatedAt: Date;
}>(flight: T) {
  return {
    id: flight.id,
    title: flight.title,
    pilotCallsign: flight.pilotCallsign,
    simulator: flight.simulator,
    glider: flight.glider,
    competitionClass: flight.competitionClass,
    startTime: flight.startTime?.toISOString() ?? null,
    durationSeconds: flight.durationSeconds,
    distanceKm: flight.distanceKm,
    olcPoints: flight.olcPoints,
    avgSpeedKmh: flight.avgSpeedKmh,
    maxAltitudeM: flight.maxAltitudeM,
    maxVarioMs: flight.maxVarioMs,
    createdAt: flight.createdAt.toISOString(),
    updatedAt: flight.updatedAt.toISOString()
  };
}
