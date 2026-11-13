export {};

type RedirectResult =
  | { status: "yes"; destination: string }
  | { status: "no" }
  | { status: "unknown" };

const DEFAULT_BACKEND_URL = "https://dr-eosin-gamma.vercel.app";
const REDIRECT_HOST_PERMISSIONS = ["https://*/*", "http://*/*"];
const REDIRECT_TIMEOUT_MS = 3000;
const MAX_REDIRECT_CACHE_ENTRIES = 500;
const redirectCache = new Map<string, RedirectResult>();
const redirectRequests = new Map<string, Promise<RedirectResult>>();

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 307 || status === 308;
}

function destinationFrom(response: Response, sourceUrl: string): RedirectResult {
  if (!isRedirectStatus(response.status)) {
    return (
      (response.status >= 200 && response.status < 300) ||
      (response.status >= 400 && response.status < 500 && ![403, 405].includes(response.status))
    )
      ? { status: "no" }
      : { status: "unknown" };
  }

  const location = response.headers.get("Location");
  if (!location) return { status: "unknown" };

  try {
    const destination = new URL(location, sourceUrl);
    if (destination.protocol !== "http:" && destination.protocol !== "https:") {
      return { status: "unknown" };
    }
    return {
      status: "yes",
      destination: destination.hostname.replace(/^www\./i, ""),
    };
  } catch {
    return { status: "unknown" };
  }
}

async function requestRedirectHeaders(
  url: string,
  method: "HEAD" | "GET",
  deadline: number,
): Promise<Response | null> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), remaining);
  try {
    return await fetch(url, {
      method,
      redirect: "manual",
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function detectRedirect(url: string): Promise<RedirectResult> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { status: "unknown" };
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return { status: "unknown" };
  }
  parsedUrl.hash = "";
  const sourceUrl = parsedUrl.href;
  const deadline = Date.now() + REDIRECT_TIMEOUT_MS;
  let headResponse: Response | null = null;
  try {
    headResponse = await requestRedirectHeaders(sourceUrl, "HEAD", deadline);
  } catch {
    if (Date.now() >= deadline) return { status: "unknown" };
  }

  if (headResponse) {
    if (headResponse.type !== "opaqueredirect" && headResponse.status !== 0) {
      if (isRedirectStatus(headResponse.status)) {
        return destinationFrom(headResponse, sourceUrl);
      }
      if (![403, 405, 501].includes(headResponse.status)) {
        return destinationFrom(headResponse, sourceUrl);
      }
    }
  }

  if (Date.now() >= deadline) return { status: "unknown" };
  let getResponse: Response | null;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(0, deadline - Date.now()),
  );
  try {
    getResponse = await fetch(sourceUrl, {
      method: "GET",
      redirect: "manual",
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    });
    controller.abort();
  } catch {
    return { status: "unknown" };
  } finally {
    clearTimeout(timeout);
  }

  if (!getResponse || getResponse.type === "opaqueredirect" || getResponse.status === 0) {
    return { status: "unknown" };
  }
  return destinationFrom(getResponse, sourceUrl);
}

function rememberRedirect(url: string, result: RedirectResult): void {
  redirectCache.delete(url);
  redirectCache.set(url, result);
  if (redirectCache.size > MAX_REDIRECT_CACHE_ENTRIES) {
    const oldestKey = redirectCache.keys().next().value;
    if (oldestKey) redirectCache.delete(oldestKey);
  }
}

function getRedirectResult(url: string): Promise<RedirectResult> {
  return chrome.permissions
    .contains({ origins: REDIRECT_HOST_PERMISSIONS })
    .then((hasPermission) => {
      if (!hasPermission) return { status: "unknown" } as RedirectResult;

      const cached = redirectCache.get(url);
      if (cached) return cached;

      const pending = redirectRequests.get(url);
      if (pending) return pending;

      const request = detectRedirect(url)
        .catch((): RedirectResult => ({ status: "unknown" }))
        .then((result) => {
          rememberRedirect(url, result);
          return result;
        })
        .finally(() => redirectRequests.delete(url));
      redirectRequests.set(url, request);
      return request;
    });
}

chrome.runtime.onInstalled.addListener(async () => {
  const { enabled, backendUrl } = await chrome.storage.local.get(["enabled", "backendUrl"]);
  const defaults: Record<string, unknown> = {};
  if (enabled === undefined) defaults.enabled = true;
  if (!backendUrl || backendUrl === "http://localhost:3000") {
    defaults.backendUrl = DEFAULT_BACKEND_URL;
  }
  if (Object.keys(defaults).length) await chrome.storage.local.set(defaults);
});

// REDIRECT FEATURE START
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (
    !message ||
    typeof message !== "object" ||
    (message as { type?: unknown }).type !== "CHECK_REDIRECT" ||
    typeof (message as { url?: unknown }).url !== "string"
  ) {
    return false;
  }

  void getRedirectResult((message as { url: string }).url).then(sendResponse);
  return true;
});
// REDIRECT FEATURE END
