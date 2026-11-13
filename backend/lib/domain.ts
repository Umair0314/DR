const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeDomain(input: string): string | null {
  const value = input.trim().toLowerCase();
  if (!value || value.length > 253 || /[\/\\@?#:\s]/.test(value)) return null;

  let hostname: string;
  try {
    hostname = new URL(`https://${value}`).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }

  if (
    hostname.length > 253 ||
    hostname === "localhost" ||
    /^\d+(?:\.\d+){3}$/.test(hostname) ||
    hostname.includes(":")
  ) {
    return null;
  }

  const domain = hostname.replace(/^www\./, "");
  const labels = domain.split(".");
  if (labels.length < 2 || labels.some((label) => !DOMAIN_LABEL.test(label))) return null;
  if (!/^[a-z]{2,63}$/.test(labels[labels.length - 1])) return null;
  return domain;
}
