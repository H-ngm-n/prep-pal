# Prep Pal: budget macro meal prep

Prep Pal is a mobile-first PWA that plans a week of budget meal prep to hit your calories and macros. It covers:
- A shopping list grouped by store and section, with check-off.
- A batch prep plan.
- Recipes.
- Leftover reuse.
- A barcode food log.
- A macro calculator with a weight log.

There's no build step. It's plain HTML, CSS and JS, and every asset path is relative, so it runs from any subpath (for example `https://<user>.github.io/prep-pal/`).

## Run locally
```
python3 -m http.server 8000
```
Then open http://localhost:8000. The camera (barcode scanning) needs HTTPS or localhost.

## Deploy (GitHub Pages)
Push this folder to a repo, then go to Settings → Pages and deploy from the branch root. After changing files, bump `C` in `sw.js` so installed apps update.

## Data & privacy
Profiles (targets, plans, checklists, food log, weights) live only in this browser's localStorage, one key per profile.
You can move a profile to another device with Export/Import. Barcode lookups call the Open Food Facts API.
Optional Firebase sync is off by default; see `SYNC_SETUP.md`.

## Prices
`prices.json` is the **canonical** price list for the Plymouth, MI area, and it is edited in place (refreshed weekly). Rows with `estimated: false` were checked by hand on public store web pages or the store's public weekly ad (Aldi Canton, Meijer Plymouth Twp, Trader Joe's Northville, Kroger weekly ad for 48170). Each of those rows has `last_updated` set to the day it was last confirmed and `source_url` set to the exact product page or weekly-ad item. Rows with `estimated: true` are still the original estimates. Kroger product pages and meijer.com block automated access, so Kroger stays mostly estimated and Meijer rows that couldn't be re-checked keep their last verified date. `gen_prices.py` is a legacy seed script, so don't rerun it: it would overwrite the verified prices. Aisles are null.
Live Kroger-family prices, store search and aisle numbers need a small proxy (`PRICE_API_URL` in `storage.js`; see `PROXY_SPEC.md`).

## Files
- `index.html`, `style.css`: the page shell and theme
- `app.js`: UI for setup, week, shop, prep, recipes, reuse and profiles
- `engine.js`: the planner (recipe choice, per-meal/daily macro fit, cost)
- `data.js`: ingredients (per 100 g) and 30 recipes
- `log.js`: food log and barcode scanning
- `macros.js`: My Macros calculator and weight log
- `storage.js`: storage layer, `SYNC_CONFIG`, `PRICE_API_URL`
- `providers.js`: store providers

Calorie and macro numbers are estimates, not medical advice.
