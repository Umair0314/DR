export {};

const DEFAULT_BACKEND_URL = "https://dr-eosin-gamma.vercel.app";
const form = document.querySelector<HTMLFormElement>("#settings-form");
const input = document.querySelector<HTMLInputElement>("#backend-url");
const status = document.querySelector<HTMLElement>("#status");

async function loadSettings(): Promise<void> {
  const { backendUrl } = await chrome.storage.local.get("backendUrl");
  if (
    input &&
    (typeof backendUrl !== "string" || backendUrl === "http://localhost:3000")
  ) {
    input.value = DEFAULT_BACKEND_URL;
    await chrome.storage.local.set({ backendUrl: DEFAULT_BACKEND_URL });
  } else if (input) {
    input.value = backendUrl;
  }
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!input || !status) return;

  let url: URL;
  try {
    url = new URL(input.value.trim());
  } catch {
    status.textContent = "Enter a valid backend URL.";
    return;
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    status.textContent = "Use HTTPS for hosted backends. HTTP is allowed only for localhost.";
    return;
  }

  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    const originPattern = `${url.origin}/*`;
    const alreadyGranted = await chrome.permissions.contains({ origins: [originPattern] });
    if (!alreadyGranted) {
      const granted = await chrome.permissions.request({ origins: [originPattern] });
      if (!granted) {
        status.textContent = "Permission was not granted; settings were not changed.";
        return;
      }
    }
  }

  await chrome.storage.local.set({ backendUrl: url.origin });
  status.textContent = "Backend URL saved.";
});

void loadSettings();
