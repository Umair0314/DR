
# AGENTS.md — Ahrefs DR SERP Chrome Extension

## 1. Project Overview

Build a lightweight Chrome Extension that displays Ahrefs Domain Rating (DR) directly underneath every organic search result on Google Search Results Pages (SERPs).

The extension should provide a MozBar-style experience but initially display ONLY Ahrefs Domain Rating.

Project name: SEO SERP Metrics

Version: 1.0.0

Primary metric: Ahrefs Domain Rating (DR)

Data provider: Official Ahrefs Free Domain Rating API.

Do not implement Moz DA, PA, organic traffic, backlinks, referring domains, or other SEO metrics in this version.

## 2. Main Objective

When a user searches on Google, the extension should:

1. Detect organic search results.
2. Extract the destination domain from each result.
3. Request its Domain Rating from the official Ahrefs API through a secure backend.
4. Display the DR score beneath the corresponding search result.
5. Cache previously retrieved results.
6. Avoid unnecessary API requests.

Example UI:

example.com

Best SEO Tools for Beginners

[Ahrefs DR: 72]

The score must be actual data returned by Ahrefs, never fabricated.

## 3. Technology Stack

Use:

- Chrome Extension Manifest V3
- TypeScript
- JavaScript
- HTML5
- CSS3
- Chrome Extension APIs
- Official Ahrefs API
- Next.js backend for secure API communication

Keep the extension lightweight.

Do not introduce React or a complex frontend framework unless absolutely necessary.

## 4. Ahrefs API Integration

Use the official endpoint:

GET https://api.ahrefs.com/v3/public/domain-rating-free

Query parameter:

target=example.com

Authentication:

Authorization: Bearer YOUR_AHREFS_API_KEY

The API key must NEVER be exposed inside extension files.

Important:

- Never place API keys in content.js.
- Never place API keys in background.js.
- Never expose API keys in popup.js.
- Never hardcode API keys in source code.
- Store secrets in backend environment variables.
- Use server-side API requests.

Environment variable:

AHREFS_API_KEY=your_ahrefs_api_key

Create a secure backend endpoint:

POST /api/metrics/dr

Request:

{
  "domains": [
    "example.com",
    "google.com"
  ]
}

The backend should:

1. Validate all requested domains.
2. Normalize domain names.
3. Remove duplicates.
4. Check cached results.
5. Fetch missing DR data from Ahrefs.
6. Return results mapped to the requested domains.
7. Handle API errors safely.

Verify the exact Ahrefs response schema using the official API documentation. Do not assume response fields without testing.

Official documentation:

https://docs.ahrefs.com/docs/api/reference/domain-rating/domain-rating-free

## 5. Chrome Extension Structure

Create the following structure:

seo-serp-metrics/
│
├── AGENTS.md
│
├── extension/
│   ├── manifest.json
│   ├── content.ts
│   ├── background.ts
│   ├── popup.html
│   ├── popup.ts
│   ├── styles.css
│   ├── settings.html
│   ├── settings.ts
│   └── icons/
│
├── backend/
│   ├── app/
│   │   └── api/
│   │       └── metrics/
│   │           └── dr/
│   │               └── route.ts
│   ├── lib/
│   │   ├── ahrefs.ts
│   │   ├── cache.ts
│   │   └── domain.ts
│   └── .env.local.example
│
├── README.md
└── .gitignore

Adjust the structure if necessary, but maintain a clear separation between the extension and backend.

## 6. Google SERP Detection

The extension must work on Google Search Results Pages.

Supported URLs:

- https://www.google.com/search?q=...
- https://www.google.co.uk/search?q=...
- Other Google country domains.

Requirements:

- Detect organic search results.
- Extract domains from result links.
- Ignore Google internal links.
- Ignore advertisements.
- Ignore navigation links.
- Ignore images, videos, maps and unrelated result modules.
- Avoid duplicate domains where appropriate.
- Support pagination and dynamically loaded results.
- Support Google SERP navigation without refreshing the entire page.

Use MutationObserver to detect newly inserted search results.

Avoid modifying Google's existing result layout.

## 7. DR Badge Design

Display a compact badge below each organic search result.

Example:

[DR 72]

Design requirements:

- Modern and minimal.
- Small typography.
- Rounded badge.
- Green for high scores.
- Orange for medium scores.
- Red for low scores.
- Neutral styling for unavailable scores.
- Responsive design.
- Must not interfere with Google Search functionality.

Suggested score colors:

DR 0–20: Red

DR 21–40: Orange

DR 41–60: Yellow

DR 61–100: Green

These colors are only visual indicators, not official Ahrefs classifications.

Include attribution:

"Domain Rating by Ahrefs"

Link to:

https://ahrefs.com/

## 8. Caching System

Implement caching to reduce unnecessary API requests.

Requirements:

- Cache domain-level DR results.
- Use normalized domain names as cache keys.
- Use a configurable cache expiration period.
- Recommended initial TTL: 7 days.
- Cache valid results.
- Handle missing and failed results appropriately.
- Avoid repeated requests for the same domain.
- Implement batch processing.

Use backend caching as the authoritative cache.

Use chrome.storage.local for lightweight client-side caching where useful.

Respect Ahrefs API terms and caching restrictions.

## 9. Popup Interface

Create a simple extension popup.

Display:

- Extension name: SEO SERP Metrics
- Extension version
- Enable/Disable toggle
- Current status
- Short description
- Attribution to Ahrefs
- Settings link

The extension must remember its enabled/disabled state.

When disabled, remove all injected DR badges from Google SERPs.

## 10. Error Handling

Handle these situations:

- Invalid API key.
- Ahrefs API errors.
- Rate limits.
- Network failures.
- Missing DR values.
- Invalid domains.
- Backend unavailable.
- Google SERP changes.

Never display incorrect scores.

If DR is unavailable, display:

DR: N/A

Do not repeatedly retry failed requests.

## 11. Performance Requirements

- Do not request the same domain repeatedly.
- Batch domains where supported by the API.
- Process only relevant organic results.
- Use asynchronous requests.
- Avoid blocking the Google search page.
- Use lazy loading where practical.
- Prevent duplicate badge insertion.
- Clean up observers and listeners when appropriate.

## 12. Security Requirements

- Protect the Ahrefs API key.
- Keep API credentials on the backend.
- Validate all incoming requests.
- Implement rate limiting.
- Restrict backend access to legitimate extension requests as far as practical.
- Do not rely on CORS or an extension ID as authentication.
- Never expose internal error details or secrets.
- Never commit .env.local.

## 13. Future Compatibility

This version must support future expansion without unnecessary rewrites.

Possible future features:

- Ahrefs organic traffic.
- Moz Domain Authority (DA).
- Moz Page Authority (PA).
- Referring domains.
- Backlinks.
- Bulk domain analysis.
- CSV export.
- Premium subscriptions.

Do not implement these features now.

Keep the metric display components modular so additional metrics can be added later.

## 14. Testing Requirements

Test the following:

1. Google search results display DR badges.
2. Correct domains receive correct DR values.
3. Duplicate domains do not generate duplicate requests.
4. Pagination works.
5. Infinite scrolling works where present.
6. Disabled extension removes badges.
7. Cached results work.
8. Invalid API keys show a safe error.
9. Missing DR values show N/A.
10. Extension does not break Google Search.

## 15. Development Rules

- Write clean, maintainable TypeScript.
- Avoid unnecessary dependencies.
- Use reusable functions.
- Keep frontend and backend responsibilities separate.
- Add comments to important logic.
- Do not invent API responses.
- Verify official Ahrefs API documentation.
- Do not scrape Ahrefs website.
- Do not use unofficial Ahrefs endpoints.
- Do not implement paid Ahrefs APIs in Version 1.

## 16. Final Deliverables

The completed project must include:

1. Working Chrome Extension.
2. Secure Next.js backend.
3. Ahrefs Free DR API integration.
4. Google SERP badge injection.
5. Domain normalization.
6. Caching.
7. Popup settings.
8. Error handling.
9. README with installation instructions.
10. Instructions for adding the Ahrefs API key.

Build and test the project before declaring it complete.
