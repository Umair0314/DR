# SEO SERP Metrics — Local Testing Guide

## Is it ready to test?

It is ready for an **initial local test**: the backend and extension build, and the extension type-checks. The backend's preflight and input-validation responses were also smoke-tested.

It is **not yet verified end-to-end** against Ahrefs or in Chrome on live Google results. The Ahrefs documentation link currently returns 404, and the endpoint response schema has not been confirmed with a live API response. Treat this as a test build, not a production release.

**Before starting:** rotate the Ahrefs API key that was previously in the root `.env.local`, then replace it with the new key. Keep it only in `.env.local`; do not paste it into chat, source code, or extension settings.

## 1. Configure and run the backend

Open Terminal and go to the project root:

```bash
cd "/Users/muhammadumair/Desktop/DR"
```

Install dependencies if this is a fresh setup:

```bash
npm install
```

Edit the root `.env.local` and put the rotated key on one line:

```dotenv
AHREFS_API_KEY=your_rotated_ahrefs_api_key
```

For example, edit it with:

```bash
nano .env.local
```

Save and exit nano with **Ctrl+O**, **Enter**, then **Ctrl+X**. Do not include spaces around `=`.

Start the backend:

```bash
npm run dev:backend
```

Leave this terminal running. By default, the backend is at `http://localhost:3000`. To check that it responds, open a second terminal and run:

```bash
curl -i http://localhost:3000/
```

An invalid-input check that does not make an Ahrefs request:

```bash
curl -i -H 'Content-Type: application/json' \
  --data '{"domains":["not a domain"]}' \
  http://localhost:3000/api/metrics/dr
```

This should return HTTP `400` with `{"error":"invalid_domain"}`. To test a real Ahrefs lookup, send a valid domain instead; that uses your API key and is subject to Ahrefs' endpoint access and limits:

```bash
curl -i -H 'Content-Type: application/json' \
  --data '{"domains":["example.com"]}' \
  http://localhost:3000/api/metrics/dr
```

The backend success shape is `{"results":[{"domain":"example.com","dr":72}]}`. The number above is only an example of the shape, **not an asserted score**. Ahrefs' current documented response nests its score at `domain_rating.domain_rating`; the backend reads and validates that field. If Ahrefs rejects the request or returns a different schema, it returns a safe provider error.

## 2. Build the Chrome extension

In another terminal, from the project root:

```bash
cd "/Users/muhammadumair/Desktop/DR"
npm run build:extension
```

This creates the loadable extension directory at:

```text
extension/dist
```

To build both backend and extension:

```bash
npm run build
```

## 3. Load it in Chrome

This project currently supports **local unpacked testing**; it is not uploaded to the Chrome Web Store.

1. In Chrome, open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Choose the project's `extension/dist` folder (not the project root and not `extension/`).
5. Confirm that **SEO SERP Metrics** appears in the extensions list.
6. Keep the backend terminal running.
7. Open a Google Search page on a supported Google country domain and search for something.
8. Use the extension popup to check or change its enabled state. The test build defaults to `https://dr-eosin-gamma.vercel.app`; use **Settings** only if you need another backend.
9. To show redirect status, click **Enable Redirect Checks** in the popup and approve Chrome's optional access to all HTTP/HTTPS websites. This is required to inspect cross-origin redirect headers. Redirect checks run in the background after DR is displayed; blocked, denied, or timed-out checks show `Redirect: Unknown`.
10. The popup's **Get Free SEO Audit** button opens `https://umairdigital.vercel.app` in a new tab.

If you rebuild the extension, return to `chrome://extensions` and click the extension's **Reload** button. Refresh the Google results tab after reloading the extension.

## 4. Host the backend on Vercel

Vercel replaces the always-running local backend terminal. The Chrome extension remains installed in Chrome and continues to run locally (or can later be published separately).

1. Put the project in a Git repository and push it to a Git provider supported by Vercel.
2. In Vercel, create a project and import that repository.
3. Set **Root Directory** to `backend`. Let Vercel detect the Next.js framework and use its default build settings.
4. In the Vercel project's **Settings → Environment Variables**, add:

   - `AHREFS_API_KEY` — your Ahrefs API key (do not add a `NEXT_PUBLIC_` prefix).
   - Optionally, `DR_CACHE_TTL_SECONDS` (default `604800`) and `DR_RATE_LIMIT_PER_MINUTE` (default `60`).

   Add the variables to the environment(s) where you will deploy (Preview and/or Production). Do not upload `.env.local` to Git.
5. Deploy the project and copy its HTTPS origin, for example `https://your-project.vercel.app`.
6. This test build defaults to `https://dr-eosin-gamma.vercel.app`. If you deploy another backend, enter its HTTPS origin in extension **Settings** (without `/api/metrics/dr`) and save. Chrome may ask permission for a custom host.
7. Test the deployment from Terminal with:

   ```bash
   curl -i -H 'Content-Type: application/json' \
     --data '{"domains":["example.com"]}' \
     https://your-project.vercel.app/api/metrics/dr
   ```

   Use your actual Vercel hostname. A successful response contains an Ahrefs-returned numeric DR. A provider error means the deployment needs investigation; it is not a score.
8. Refresh Google Search. The extension sends requests to Vercel; the Ahrefs key remains server-side in Vercel's environment variables.

The backend's cache and rate limiter currently use in-memory process storage. On Vercel these may reset between invocations or differ across serverless instances. This is acceptable for initial testing; for production traffic, replace them with shared cache and rate-limit storage. Do not rely on CORS or an extension ID as backend authentication.

The shared test ZIP is preconfigured to use `https://dr-eosin-gamma.vercel.app`. New installs use that backend automatically; installs upgrading from the old `http://localhost:3000` default migrate to the Vercel URL. Custom backend URLs are preserved.

## 5. What to verify

- Search results show a badge only when an Ahrefs rating was returned; missing data should show `DR: N/A`.
- The badge is below the organic result's meta description when Google provides one, and links to Ahrefs attribution. For results without a snippet, it falls back to placement after the title.
- The badge shows the DR score and redirect result on one line. Redirect lookup uses manual `HEAD`, falls back to `GET` with immediate abort after headers when needed, times out after three seconds per URL, and uses an in-memory service-worker `Map` cache only.
- Redirect inspection requires optional all-sites permission. The user must click **Enable Redirect Checks** in the popup and accept Chrome's permission prompt; no redirect API or backend is used.
- Repeated domains do not cause duplicate badges or repeated immediate lookups.
- Results added dynamically or after Google navigation are handled.
- Turning the extension off removes badges; turning it on restores processing.
- The browser's Developer Tools console and the backend terminal show no runtime errors.

The extension's local cache can delay repeat requests: valid results are cached in Chrome for 24 hours, unavailable results for 10 minutes, and the backend cache defaults to seven days. A cached result may not call Ahrefs again during a test.

## 6. Troubleshooting

- **No badges:** confirm the backend is running, the extension is enabled, the active Google host is listed in `extension/manifest.json`, and the page is a `/search` results page.
- **`OPTIONS /api/metrics/dr 403`:** the backend permits Chrome extension origins and HTTPS `www.google` country-domain origins. Rebuild the extension (`npm run build:extension`), reload it at `chrome://extensions`, and refresh the Google results tab. The extension itself only runs on Google hosts listed in `extension/manifest.json`; add other hosts to both manifest match/host lists if needed. If it still fails, inspect the failed OPTIONS request in Chrome DevTools → Network → Headers and check its `Origin` value; do not share request headers that contain credentials.
- **`provider_not_configured`:** stop the backend with **Ctrl+C**, confirm the root `.env.local` has a non-empty `AHREFS_API_KEY=...` assignment, then start `npm run dev:backend` again. The backend searches for the root `.env.local` whether the workspace command starts Next.js from the repository root or `backend/`.
- **Connection or permission error:** check the backend URL in extension Settings and ensure the backend is reachable from Chrome. For local testing, use `http://localhost:3000`.
- **Vercel deployment errors:** confirm the Vercel Root Directory is `backend`, `AHREFS_API_KEY` is configured for the deployed environment, and redeploy after changing environment variables.
- **`provider_auth_failed` / provider error:** check the rotated key in root `.env.local`, restart the backend, and verify that the key has access to the Free Domain Rating endpoint.
- **Google host is unsupported:** add that host to both `host_permissions` and the content script's `matches` in `extension/manifest.json`, rebuild, and reload the extension.
- **Hydration warning on the backend home page:** the shown `bis_skin_checked` and `__processed_...` attributes are inserted by an installed browser extension before Next.js hydrates. They are unrelated to the API `OPTIONS` response and should not affect the extension's Google Search results page. For confirmation, open the backend in a clean browser profile with other extensions disabled.

Do not expose the API key in browser DevTools, the extension bundle, screenshots, logs, or support requests.
