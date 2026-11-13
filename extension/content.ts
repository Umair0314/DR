type Settings = { enabled?: boolean; backendUrl?: string };
type CachedRating = { dr: number | null; expiresAt: number };
type ResultItem = { domain: string; target: HTMLElement };
type MetricsResponse = { results: { domain: string; dr: number | null }[] };

const BADGE_SELECTOR = "[data-seo-serp-metrics]";
const CACHE_KEY = "domainRatingsV2";
const LEGACY_CACHE_KEY = "domainRatings";
const DEFAULT_BACKEND_URL = "https://dr-eosin-gamma.vercel.app";
const NEGATIVE_CACHE_TTL = 10 * 60 * 1000;
const POSITIVE_CACHE_TTL = 24 * 60 * 60 * 1000;
const MAX_DOMAINS_PER_REQUEST = 10;
const pendingResults = new Map<string, Set<HTMLElement>>();
const queuedDomains = new Set<string>();
const requestedDomains = new Set<string>();
let enabled = true;
let scanTimer = 0;
let flushTimer = 0;
let lastUrl = location.href;

function isGoogleSearchPage(): boolean {
  return /^www\.google\.[a-z.]+$/i.test(location.hostname) && location.pathname === "/search";
}

function resultContainer(anchor: HTMLAnchorElement): HTMLElement | null {
  const result = anchor.closest<HTMLElement>("div.MjjYud, div.g");
  if (!result || !document.querySelector("#rso")?.contains(result)) return null;
  if (result.closest("#tads, #tadsb, [data-text-ad], .uEierd, [aria-label*='sponsored' i]")) {
    return null;
  }
  if (result.closest("[data-attrid], g-scrolling-carousel")) return null;
  return result;
}

function normalizedHostname(href: string): string | null {
  try {
    const url = new URL(href);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
    if (
      host === "google.com" ||
      /^google\.[a-z.]+$/.test(host) ||
      host.endsWith(".google.com") ||
      host.endsWith(".googleusercontent.com") ||
      host === "googleadservices.com" ||
      host.endsWith(".googleadservices.com") ||
      host === "doubleclick.net" ||
      host.endsWith(".doubleclick.net") ||
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtu.be" ||
      host === "maps.google.com"
    ) {
      return null;
    }

    const labels = host.split(".");
    if (
      host.length > 253 ||
      /^\d+(?:\.\d+){3}$/.test(host) ||
      labels.length < 2 ||
      labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
      !/^[a-z]{2,63}$/.test(labels[labels.length - 1])
    ) {
      return null;
    }
    return host;
  } catch {
    return null;
  }
}

function badgeElement(dr: number | null): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.dataset.seoSerpMetrics = "true";
  badge.dir = "ltr";
  badge.className = "seo-serp-metrics-badge";
  badge.style.setProperty("all", "initial", "important");
  badge.style.setProperty("display", "inline-flex", "important");
  badge.style.setProperty("direction", "ltr", "important");
  badge.style.setProperty("unicode-bidi", "isolate", "important");
  badge.style.setProperty("writing-mode", "horizontal-tb", "important");
  badge.style.setProperty("vertical-align", "middle", "important");
  badge.style.setProperty("margin", "5px 0 0", "important");
  badge.title = "Domain Rating by Ahrefs";

  const shadow = badge.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host {
      direction: ltr !important;
      unicode-bidi: isolate !important;
      writing-mode: horizontal-tb !important;
      font: 600 11px/1.4 Arial, sans-serif !important;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border: 1px solid transparent;
      border-radius: 999px;
      direction: ltr !important;
      unicode-bidi: isolate !important;
      white-space: nowrap;
      transform: scaleY(-1);
    }
    bdi, a {
      direction: ltr !important;
      unicode-bidi: isolate !important;
      writing-mode: horizontal-tb !important;
    }
    a { color: #637067; font-weight: 400; text-decoration: none; }
    a:hover { color: #17653c; text-decoration: underline; }
    .low { border-color: #f2c5c2; background: #fff0ef; color: #a12e26; }
    .medium { border-color: #f4d2a8; background: #fff5e8; color: #9a570e; }
    .fair { border-color: #eee0a2; background: #fffbe4; color: #786000; }
    .high { border-color: #b7e1ca; background: #eaf8f0; color: #17653c; }
    .unavailable { border-color: #dce2de; background: #f3f5f4; color: #68736d; }
  `;
  const content = document.createElement("span");
  const scoreClass =
    dr === null ? "unavailable" : dr <= 20 ? "low" : dr <= 40 ? "medium" : dr <= 60 ? "fair" : "high";
  content.className = `badge ${scoreClass}`;
  content.dir = "ltr";

  const score = document.createElement("bdi");
  score.dir = "ltr";
  score.textContent = dr === null ? "DR: N/A" : `DR ${dr}`;
  content.append(score);

  const attribution = document.createElement("a");
  attribution.dir = "ltr";
  attribution.href = "https://ahrefs.com/";
  attribution.target = "_blank";
  attribution.rel = "noreferrer";
  const attributionText = document.createElement("bdi");
  attributionText.dir = "ltr";
  attributionText.textContent = " · Domain Rating by Ahrefs";
  attribution.append(attributionText);
  content.append(attribution);
  shadow.append(style, content);
  return badge;
}

function setBadge(target: HTMLElement, dr: number | null): void {
  if (!enabled || !target.isConnected) return;
  target.querySelector(BADGE_SELECTOR)?.remove();
  const title = target.querySelector("h3");
  if (!title) return;
  const snippet = target.querySelector<HTMLElement>(
    ".VwiC3b, .IsZvec, .aCOpRe, [data-sncf]",
  );
  (snippet ?? title).insertAdjacentElement("afterend", badgeElement(dr));
}

function isFresh(entry: CachedRating | undefined): entry is CachedRating {
  return Boolean(entry && entry.expiresAt > Date.now());
}

async function cachedRatings(): Promise<Record<string, CachedRating>> {
  const data = await chrome.storage.local.get(CACHE_KEY);
  const saved = data[CACHE_KEY];
  return saved && typeof saved === "object" ? (saved as Record<string, CachedRating>) : {};
}

async function saveRatings(ratings: Record<string, CachedRating>): Promise<void> {
  const entries = Object.entries(ratings)
    .filter(([, value]) => value.expiresAt > Date.now())
    .slice(-500);
  await chrome.storage.local.set({ [CACHE_KEY]: Object.fromEntries(entries) });
}

function queueDomain(domain: string, target: HTMLElement): void {
  const existing = pendingResults.get(domain) ?? new Set<HTMLElement>();
  existing.add(target);
  pendingResults.set(domain, existing);
  queuedDomains.add(domain);
  if (!flushTimer) flushTimer = window.setTimeout(() => void flushQueue(), 150);
}

async function fetchBatch(domains: string[], backendUrl: string): Promise<MetricsResponse> {
  const response = await fetch(`${backendUrl.replace(/\/+$/, "")}/api/metrics/dr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domains }),
  });
  if (!response.ok) throw new Error("metrics_backend_unavailable");
  return (await response.json()) as MetricsResponse;
}

async function flushQueue(): Promise<void> {
  flushTimer = 0;
  if (!enabled || !isGoogleSearchPage()) return;

  const domains = [...queuedDomains];
  queuedDomains.clear();
  const stored = await cachedRatings();
  const settings = (await chrome.storage.local.get(["enabled", "backendUrl"])) as Settings;
  if (settings.enabled === false) {
    disableBadges();
    return;
  }
  const backendUrl = settings.backendUrl || DEFAULT_BACKEND_URL;
  const now = Date.now();
  const toFetch: string[] = [];

  for (const domain of domains) {
    const cache = stored[domain];
    if (isFresh(cache)) {
      pendingResults.get(domain)?.forEach((target) => setBadge(target, cache.dr));
      pendingResults.delete(domain);
      continue;
    }
    if (cache) requestedDomains.delete(domain);
    if (requestedDomains.has(domain)) continue;
    requestedDomains.add(domain);
    toFetch.push(domain);
  }

  for (let index = 0; index < toFetch.length; index += MAX_DOMAINS_PER_REQUEST) {
    const batch = toFetch.slice(index, index + MAX_DOMAINS_PER_REQUEST);
    try {
      const response = await fetchBatch(batch, backendUrl);
      const received = new Map(response.results.map((entry) => [entry.domain.toLowerCase(), entry.dr]));
      for (const domain of batch) {
        const dr = received.get(domain) ?? null;
        stored[domain] = { dr, expiresAt: now + (dr === null ? NEGATIVE_CACHE_TTL : POSITIVE_CACHE_TTL) };
        pendingResults.get(domain)?.forEach((target) => setBadge(target, dr));
        pendingResults.delete(domain);
      }
    } catch {
      for (const domain of batch) {
        stored[domain] = { dr: null, expiresAt: now + NEGATIVE_CACHE_TTL };
        pendingResults.get(domain)?.forEach((target) => setBadge(target, null));
        pendingResults.delete(domain);
      }
    }
  }
  await saveRatings(stored);
}

function scanResults(): void {
  if (!enabled || !isGoogleSearchPage()) return;
  const results = document.querySelectorAll<HTMLElement>("#rso a");
  for (const anchor of results) {
    if (!(anchor instanceof HTMLAnchorElement) || !anchor.querySelector("h3")) continue;
    const container = resultContainer(anchor);
    if (!container || container.querySelector(BADGE_SELECTOR)) continue;
    const domain = normalizedHostname(anchor.href);
    if (!domain) continue;
    queueDomain(domain, container);
  }
}

function scheduleScan(): void {
  if (scanTimer) window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(() => {
    scanTimer = 0;
    if (lastUrl !== location.href) {
      lastUrl = location.href;
      requestedDomains.clear();
      pendingResults.clear();
      queuedDomains.clear();
    }
    scanResults();
  }, 100);
}

function disableBadges(): void {
  document.querySelectorAll(BADGE_SELECTOR).forEach((badge) => badge.remove());
  enabled = false;
}

async function initialize(): Promise<void> {
  if (!isGoogleSearchPage()) return;
  await chrome.storage.local.remove(LEGACY_CACHE_KEY);
  const stored = await chrome.storage.local.get("enabled");
  enabled = stored.enabled !== false;
  if (enabled) scanResults();

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", scheduleScan);
  window.addEventListener("hashchange", scheduleScan);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.enabled) return;
    if (changes.enabled.newValue === false) disableBadges();
    else {
      enabled = true;
      scanResults();
    }
  });
}

void initialize();
