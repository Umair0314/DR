import { NextRequest, NextResponse } from "next/server";
import { AhrefsApiError, fetchDomainRating } from "@/lib/ahrefs";
import { cacheDr, getCachedDr, getOrFetchDr } from "@/lib/cache";
import { normalizeDomain } from "@/lib/domain";

export const runtime = "nodejs";

type Result = { domain: string; dr: number | null };
type RateWindow = { count: number; resetAt: number };

const rateWindows = new Map<string, RateWindow>();
const MAX_DOMAINS_PER_REQUEST = 10;

function rateLimit(): number {
  const configured = Number(process.env.DR_RATE_LIMIT_PER_MINUTE);
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, 300) : 60;
}

function requestIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isAllowedExtensionOrigin(origin: string | null): boolean {
  if (!origin) return true;
  if (process.env.ALLOWED_EXTENSION_ORIGIN === origin) return true;
  if (/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) return true;

  try {
    const parsedOrigin = new URL(origin);
    if (
      parsedOrigin.protocol === "https:" &&
      /^www\.google\.(?:[a-z]{2,3}\.)?[a-z]{2,3}$/.test(parsedOrigin.hostname) &&
      parsedOrigin.origin === origin
    ) {
      return true;
    }

    return (
      process.env.NODE_ENV !== "production" &&
      parsedOrigin.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsedOrigin.hostname) &&
      parsedOrigin.port === "3000" &&
      parsedOrigin.origin === origin
    );
  } catch {
    return false;
  }
}

function corsHeaders(origin: string | null): HeadersInit {
  if (!origin || !isAllowedExtensionOrigin(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function jsonResponse(body: unknown, status: number, origin: string | null): NextResponse {
  return NextResponse.json(body, { status, headers: corsHeaders(origin) });
}

function takeRateLimit(ip: string): boolean {
  const now = Date.now();
  for (const [key, window] of rateWindows) {
    if (window.resetAt <= now) rateWindows.delete(key);
  }

  const window = rateWindows.get(ip);
  if (!window || window.resetAt <= now) {
    rateWindows.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (window.count >= rateLimit()) return false;
  window.count += 1;
  return true;
}

async function fetchUncachedRating(domain: string): Promise<number> {
  return getOrFetchDr(domain, () => fetchDomainRating(domain));
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin");
  if (!isAllowedExtensionOrigin(origin)) {
    return jsonResponse({ error: "origin_not_allowed" }, 403, null);
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin");
  if (!isAllowedExtensionOrigin(origin)) {
    return jsonResponse({ error: "origin_not_allowed" }, 403, null);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 4096) {
    return jsonResponse({ error: "request_too_large" }, 413, origin);
  }

  if (!takeRateLimit(requestIp(request))) {
    return jsonResponse({ error: "rate_limited" }, 429, origin);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, origin);
  }

  if (
    !body ||
    typeof body !== "object" ||
    !Array.isArray((body as Record<string, unknown>).domains) ||
    (body as { domains: unknown[] }).domains.length === 0 ||
    (body as { domains: unknown[] }).domains.length > MAX_DOMAINS_PER_REQUEST ||
    !(body as { domains: unknown[] }).domains.every((domain) => typeof domain === "string")
  ) {
    return jsonResponse({ error: "invalid_request" }, 400, origin);
  }

  const requestedDomains = (body as { domains: string[] }).domains;
  const normalizedByRequest = requestedDomains.map((domain) => normalizeDomain(domain));
  if (normalizedByRequest.some((domain) => domain === null)) {
    return jsonResponse({ error: "invalid_domain" }, 400, origin);
  }

  const uniqueDomains = [...new Set(normalizedByRequest as string[])];
  const failures: AhrefsApiError[] = [];
  const resultsByDomain = new Map<string, number | null>();
  const concurrency = 3;
  let cursor = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, uniqueDomains.length) }, async () => {
      while (cursor < uniqueDomains.length) {
        const domain = uniqueDomains[cursor++];
        const cached = getCachedDr(domain);
        if (cached !== undefined) {
          resultsByDomain.set(domain, cached);
          continue;
        }

        try {
          const dr = await fetchUncachedRating(domain);
          cacheDr(domain, dr);
          resultsByDomain.set(domain, dr);
        } catch (error) {
          failures.push(
            error instanceof AhrefsApiError ? error : new AhrefsApiError("provider"),
          );
        }
      }
    }),
  );

  if (failures.length === uniqueDomains.length) {
    const kinds = new Set(failures.map((failure) => failure.kind));
    const status = kinds.has("unauthorized") ? 502 : kinds.has("rate_limited") ? 503 : 502;
    const error = kinds.has("configuration")
      ? "provider_not_configured"
      : kinds.has("unauthorized")
        ? "provider_auth_failed"
        : kinds.has("rate_limited")
          ? "provider_rate_limited"
          : "provider_unavailable";
    return jsonResponse({ error }, status, origin);
  }

  const results: Result[] = requestedDomains.map((original, index) => {
    const domain = normalizedByRequest[index] as string;
    return { domain: original, dr: resultsByDomain.get(domain) ?? null };
  });
  return jsonResponse({ results }, 200, origin);
}
