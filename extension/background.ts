chrome.runtime.onInstalled.addListener(async () => {
  const { enabled, backendUrl } = await chrome.storage.local.get(["enabled", "backendUrl"]);
  const defaults: Record<string, unknown> = {};
  if (enabled === undefined) defaults.enabled = true;
  if (!backendUrl) defaults.backendUrl = "http://localhost:3000";
  if (Object.keys(defaults).length) await chrome.storage.local.set(defaults);
});
