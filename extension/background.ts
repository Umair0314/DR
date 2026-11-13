export {};

const DEFAULT_BACKEND_URL = "https://dr-eosin-gamma.vercel.app";

chrome.runtime.onInstalled.addListener(async () => {
  const { enabled, backendUrl } = await chrome.storage.local.get(["enabled", "backendUrl"]);
  const defaults: Record<string, unknown> = {};
  if (enabled === undefined) defaults.enabled = true;
  if (!backendUrl || backendUrl === "http://localhost:3000") {
    defaults.backendUrl = DEFAULT_BACKEND_URL;
  }
  if (Object.keys(defaults).length) await chrome.storage.local.set(defaults);
});
