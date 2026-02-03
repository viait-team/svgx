# SVGX — Yield Data Automation

This project displays live US yield data in SVG charts. To avoid brittle client-side CORS proxies, the repository includes a GitHub Action that periodically fetches the source page and writes `data/yield.json`.

## Quick start (local)

Requirements:
- Node.js 18+

Install dependencies:

```bash
npm ci
```

Run the fetch script locally (parses the TradingEconomics page and writes `data/yield.json`):

```bash
node scripts/fetch_yield.js
```

Check the output file:

```bash
cat data/yield.json
```

If the script exits with an error, inspect the printed error message for HTTP errors or parsing failures.

## GitHub Action

Workflow: `.github/workflows/update-yield.yml` — runs every 5 minutes and on manual dispatch. It:
- checks out the repo
- runs `node scripts/fetch_yield.js`
- commits `data/yield.json` if changed

Notes:
- Public repos can run Actions for free; private repos may incur minutes usage.
- Scheduling more frequently than 1 minute can hit GitHub Actions limits — keep the cron to 1–5 minutes for near‑real‑time.

## Client behavior

Client scripts (`main.js`, `main20.js`, `main_cbo.js`) now:
- try `data/yield.json` first (fetched with cache disabled)
- fall back to proxy scraping only if `data/yield.json` missing

The client polls every 60 seconds (60000 ms). To adjust polling, edit the `setInterval` value in the client files.

## Troubleshooting

- If the Action fails with HTTP 403, the target may block server requests; try adding an official API key or run the Action from a proxy you control.
- If the client still shows fetch failures on GitHub Pages, open DevTools Network and inspect `data/yield.json` request and the small on-page status box (bottom-right) for error text.

### NPM / `npm ci` troubleshooting

If you see an error like `npm ci` requires a lockfile, take one of these options:

- Generate and commit a lockfile locally (recommended):

```bash
# Install dependencies and create package-lock.json
npm install

# Run the fetch script locally to verify it works
node scripts/fetch_yield.js

# Commit lockfile and initial data file
git add package-lock.json data/yield.json
git commit -m "chore: add package-lock and initial yield" 
git push
```

This allows the workflow to use `npm ci` (fast, deterministic) on GitHub Actions.

- Alternate: change the workflow to use `npm install` instead of `npm ci` (less strict):

Edit `.github/workflows/update-yield.yml` and replace the `Install dependencies` step with:

```yaml
- name: Install dependencies
	run: npm install
```

Either approach fixes the `EUSAGE` error when running `npm ci` in the Action.

## Optional: Use an official API

TradingEconomics offers an API (requires key). To use it instead of scraping, update `scripts/fetch_yield.js` to call the API, and store the API key in the repository Secrets. The Action can read secrets automatically.

## Files added/changed

- [.github/workflows/update-yield.yml](.github/workflows/update-yield.yml)
- `scripts/fetch_yield.js` (fetch + parse)
- `package.json` (dependencies + script)
- `data/yield.json` (initial placeholder)
- Client changes in `main.js`, `main20.js`, `main_cbo.js` to prefer `data/yield.json`

If you want, I can adjust the Action schedule or switch to an official API integration.



#
git checkout data/yield.json
git add .github README.md package.json scripts main.js main20.js main_cbo.js
git commit -m "chore: add workflow, fetch script, client changes"
git push origin main