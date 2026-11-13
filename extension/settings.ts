export {};

const form = document.querySelector<HTMLFormElement>("#settings-form");
const input = document.querySelector<HTMLInputElement>("#backend-url");
const status = document.querySelector<HTMLElement>("#status");

async function loadSettings(): Promise<void> {
  const { backendUrl } = await chrome.storage.local.get("backendUrl");
  if (input) input.value = typeof backendUrl === "string" ? backendUrl : "http://localhost:3000";
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
    const granted = await chrome.permissions.request({ origins: [`${url.origin}/*`] });
    if (!granted) {
      status.textContent = "Permission was not granted; settings were not changed.";
      return;
    }
  }

  await chrome.storage.local.set({ backendUrl: url.origin });
  status.textContent = "Backend URL saved.";
});

void loadSettings();
