export {};

const enabledToggle = document.querySelector<HTMLInputElement>("#enabled");
const status = document.querySelector<HTMLElement>("#status");
const settingsButton = document.querySelector<HTMLButtonElement>("#settings");
const version = document.querySelector<HTMLElement>("#version");

async function load(): Promise<void> {
  if (!enabledToggle || !status || !version) return;
  const [values, manifest] = await Promise.all([
    chrome.storage.local.get("enabled"),
    Promise.resolve(chrome.runtime.getManifest()),
  ]);
  enabledToggle.checked = values.enabled !== false;
  version.textContent = `Version ${manifest.version}`;
  updateStatus();
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

void load();
