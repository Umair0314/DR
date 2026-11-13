export {};

const enabledToggle = document.querySelector<HTMLInputElement>("#enabled");
const status = document.querySelector<HTMLElement>("#status");
const settingsButton = document.querySelector<HTMLButtonElement>("#settings");
const version = document.querySelector<HTMLElement>("#version");
const redirectPermissionStatus = document.querySelector<HTMLElement>("#redirect-permission-status");
const enableRedirectChecksButton = document.querySelector<HTMLButtonElement>("#enable-redirect-checks");
const auditButton = document.querySelector<HTMLButtonElement>("#seo-audit");
const REDIRECT_HOST_PERMISSIONS = ["https://*/*", "http://*/*"];
const AUDIT_URL = "https://umairdigital.vercel.app";

async function load(): Promise<void> {
  if (!enabledToggle || !status || !version) return;
  const [values, manifest] = await Promise.all([
    chrome.storage.local.get("enabled"),
    Promise.resolve(chrome.runtime.getManifest()),
  ]);
  enabledToggle.checked = values.enabled !== false;
  version.textContent = `Version ${manifest.version}`;
  updateStatus();
  await updateRedirectPermissionStatus();
}

function updateStatus(): void {
  if (enabledToggle && status) status.textContent = enabledToggle.checked ? "Status: Enabled" : "Status: Disabled";
}

enabledToggle?.addEventListener("change", async () => {
  await chrome.storage.local.set({ enabled: enabledToggle.checked });
  updateStatus();
});

settingsButton?.addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
});

async function updateRedirectPermissionStatus(): Promise<void> {
  const granted = await chrome.permissions.contains({
    origins: REDIRECT_HOST_PERMISSIONS,
  });
  if (redirectPermissionStatus) {
    redirectPermissionStatus.textContent = granted
      ? "Redirect checks are enabled."
      : "Redirect checks need optional access to all websites.";
  }
  if (enableRedirectChecksButton) enableRedirectChecksButton.hidden = granted;
}

enableRedirectChecksButton?.addEventListener("click", async () => {
  if (!redirectPermissionStatus) return;
  const granted = await chrome.permissions.request({
    origins: REDIRECT_HOST_PERMISSIONS,
  });
  redirectPermissionStatus.textContent = granted
    ? "Enabled. Refresh Google results to check redirects."
    : "Site access was not granted; redirects will show Unknown.";
  if (granted && enableRedirectChecksButton) enableRedirectChecksButton.hidden = true;
});

auditButton?.addEventListener("click", () => {
  void chrome.tabs.create({ url: AUDIT_URL });
});

void load();
