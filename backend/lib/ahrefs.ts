import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

const AHREFS_ENDPOINT = "https://api.ahrefs.com/v3/public/domain-rating-free";

function loadWorkspaceApiKey(): string | undefined {
  const currentDirectory = process.cwd();
  const parentDirectory = path.resolve(currentDirectory, "..");
  const projectRoot = existsSync(path.join(currentDirectory, "backend", "package.json"))
    ? currentDirectory
    : existsSync(path.join(parentDirectory, "backend", "package.json"))
      ? parentDirectory
      : currentDirectory;
  const { parsedEnv } = loadEnvConfig(
    projectRoot,
    process.env.NODE_ENV !== "production",
    undefined,
    true,
  );
  const apiKey = parsedEnv?.AHREFS_API_KEY?.trim();
  if (apiKey) process.env.AHREFS_API_KEY = apiKey;
  return apiKey;
}

export class AhrefsApiError extends Error {
  constructor(
    public readonly kind: "configuration" | "unauthorized" | "rate_limited" | "provider",
  ) {
    super(kind);
    this.name = "AhrefsApiError";
  }
}

function extractDomainRating(payload: unknown): number | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const domainRating = (payload as Record<string, unknown>).domain_rating;
  if (!domainRating || typeof domainRating !== "object" || Array.isArray(domainRating)) {
    return null;
  }
  const value = (domainRating as Record<string, unknown>).domain_rating;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    return null;
  }
  return value;
}

export async function fetchDomainRating(domain: string): Promise<number> {
  const apiKey = process.env.AHREFS_API_KEY?.trim() || loadWorkspaceApiKey();
  if (!apiKey) throw new AhrefsApiError("configuration");

  const url = new URL(AHREFS_ENDPOINT);
  url.searchParams.set("target", domain);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    throw new AhrefsApiError("provider");
  }

  if (response.status === 401 || response.status === 403) {
    throw new AhrefsApiError("unauthorized");
  }
  if (response.status === 429) throw new AhrefsApiError("rate_limited");
  if (!response.ok) throw new AhrefsApiError("provider");

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AhrefsApiError("provider");
  }

  const rating = extractDomainRating(payload);
  if (rating === null) throw new AhrefsApiError("provider");
  return rating;
}
