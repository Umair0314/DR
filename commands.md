# Update and publish commands

Run these commands in Terminal from the project folder whenever you change the extension:

```bash
cd "/Users/muhammadumair/Desktop/DR"
npm run typecheck --workspace extension
npm run build:extension
```

The generated unpacked extension is in `extension/dist`. Reload it from `chrome://extensions` and refresh the Google results tab to test your change.

## Recreate the share ZIP

After building the extension, run this from the project root:

```bash
python3 - <<'PY'
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

build_dir = Path("extension/dist")
archive = Path("seo-serp-metrics-test.zip")
files = [path for path in build_dir.rglob("*") if path.is_file()]
if not any(path.name == "manifest.json" for path in files):
    raise SystemExit("Extension build is missing manifest.json; run npm run build:extension first.")

instructions = """SEO SERP Metrics - Chrome test build

1. Extract this ZIP.
2. In Chrome, open chrome://extensions and enable Developer mode.
3. Click Load unpacked and select the extracted folder containing manifest.json.
4. Approve Chrome permission for https://dr-eosin-gamma.vercel.app if prompted.
5. The backend URL is preconfigured.
6. Open a Google Search results page.

This package contains the extension only, not a backend or API key.
"""

with ZipFile(archive, "w", ZIP_DEFLATED) as zipped:
    for path in files:
        zipped.write(path, path.relative_to(build_dir).as_posix())
    zipped.writestr("TESTING.txt", instructions)

print(f"Created {archive}")
PY
```

## Commit and push updates

Review the changed file list before staging. Stage only the files you intend to publish; do not use `git add .` because it can include local or secret files.

```bash
git status
git add extension/content.ts extension/styles.css seo-serp-metrics-test.zip commands.md
git diff --cached --check
git status
git commit -m "Describe your update"
git push origin main
```

Replace the example paths in `git add` with the files you actually changed. For backend changes, run `npm run build:backend` before committing. Pushing to the connected Git repository normally triggers a Vercel deployment; confirm it completes successfully in Vercel.

## Secret safety

- Never stage or push `.env.local`; it contains your private Ahrefs API key and is ignored by Git.
- Keep `AHREFS_API_KEY` only in Vercel Environment Variables for the deployed backend.
- Do not put API keys in the extension, this ZIP, screenshots, commands, or Git commits.
