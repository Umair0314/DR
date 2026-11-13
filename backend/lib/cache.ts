type CacheEntry = {
  dr: number | null;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<number>>();
const MAX_CACHE_ENTRIES = 2000;
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

function ttlSeconds(): number {
  const configured = Number(process.env.DR_CACHE_TTL_SECONDS);
  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, 30 * 24 * 60 * 60)
    : DEFAULT_TTL_SECONDS;
}

export function getCachedDr(domain: string): number | null | undefined {
  const entry = cache.get(domain);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(domain);
    return undefined;
  }
  return entry.dr;
}

export function cacheDr(domain: string, dr: number | null, ttl = ttlSeconds()): void {
  if (cache.size >= MAX_CACHE_ENTRIES && !cache.has(domain)) {
    const oldestDomain = cache.keys().next().value;
    if (oldestDomain) cache.delete(oldestDomain);
  }
  cache.delete(domain);
  cache.set(domain, { dr, expiresAt: Date.now() + ttl * 1000 });
}

export function getOrFetchDr(domain: string, fetcher: () => Promise<number>): Promise<number> {
  const pending = inFlight.get(domain);
  if (pending) return pending;

  const request = fetcher().finally(() => inFlight.delete(domain));
  inFlight.set(domain, request);
  return request;
}
