# SEO SERP Metrics

Version 1.0.0 is a lightweight Chrome Extension and Next.js backend that displays the official Ahrefs Domain Rating (DR) for organic Google Search results. It does not expose the Ahrefs API key to the browser.

## Requirements

- Node.js 20.9 or later and npm
- Chrome
- An Ahrefs API key with access to the Free Domain Rating endpoint

## Configure the backend

1. Set `AHREFS_API_KEY` in the project-root `.env.local` to your Ahrefs API key. The backend loads that file when running from this workspace. Alternatively, configure `backend/.env.local`.
2. Do not put credentials in any extension file or commit `.env.local`.
3. From the project root, run `npm install` and then `npm run dev:backend`.
4. The backend runs at `http://localhost:3000`. Set cache lifetime and per-process request rate in the env file if needed.

The backend accepts `POST /api/metrics/dr` with a JSON body such as:

```json
{ "domains": ["example.com", "google.com"] }
```

It normalizes and deduplicates domains, validates inputs, caches valid ratings for seven days by default, and returns `{ "results": [{ "domain": "example.com", "dr": 72 }] }`. The Ahrefs API is called once per uncached domain; the Free endpoint does not accept a multi-domain batch.

The backend rate limit and cache are process-local. For a multi-instance production deployment, use shared persistent storage and a distributed rate limiter. Configure a public HTTPS backend origin in the extension's Settings before installing the production extension. The endpoint must be reachable by the extension; CORS is only a browser access policy and is not authentication.

## Build and install the extension

1. Run `npm install` and `npm run build:extension` from the project root.
2. In Chrome, open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
3. Select the generated `extension/dist` folder.
4. Click the extension icon to enable/disable badges or open **Settings** to configure your backend URL.

Google country domains are explicitly listed in `extension/manifest.json`. Add additional country hosts to both `host_permissions` and the content script's `matches` if your Google domain is not included.

## Behavior and safety

- Only search-result links with a result heading are considered; Google internal links, ad containers, and common video results are ignored.
- The content script observes dynamic result changes and Google SPA navigation and batches up to ten domains per backend request.
- Client cache entries are held in `chrome.storage.local`; successful values expire after 24 hours and unavailable values after ten minutes. The backend cache is authoritative.
- Unavailable data displays `DR: N/A`; the extension never substitutes a made-up score.
- The backend sends only normalized domain requests to `https://api.ahrefs.com/v3/public/domain-rating-free` using `Authorization: Bearer ...`.
- The official Ahrefs OpenAPI response schema returns the score at `domain_rating.domain_rating`. The backend validates that nested value is numeric and between 0 and 100 before returning it; confirm endpoint access with your account before deployment.
- The backend applies request validation, per-process rate limiting, timeouts, safe error responses, and extension-origin CORS handling. CORS and extension IDs are not treated as authentication.

For local setup and Chrome testing steps, see [guide.md](./guide.md).
