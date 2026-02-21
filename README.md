# CarbCycler PWA

Offline-first carb cycling meal planner for iPad users, built with React + TypeScript + Vite + Workbox (via `vite-plugin-pwa`).

## Features

- Fully client-side: no backend, no API calls.
- Offline support after first load:
  - App shell cached by service worker.
  - `foods.json` cached with `CacheFirst`.
  - Offline navigation fallback page.
- Carb cycling calculator:
  - Inputs: sex, weight_kg, body_type, protein_g_per_kg, ecto fat, cycle_days, day counts, shares.
  - Rules:
    - Endo: carb=2.0, fat=0.8
    - Ecto: carb=3.0, fat=1.0–1.2
  - `P_day = weight * protein_g_per_kg`
  - `C_total = weight * carb_g_per_kg * cycle_days`
  - `F_total = weight * fat_g_per_kg * cycle_days`
  - Day-level macro targets generated from shares and day counts.
- Day-by-day placement editor (High/Medium/Low) with count validation.
- Built-in foods database (`public/foods.json`) with 151 foods (Chinese + Western), categories, and emoji icons.
- Basis per selected food (`raw` / `cooked` / `fresh` where available).
- Greedy auto-grams generator for selected day and foods.
- Manual grams editing with live totals and deviations.
- Custom foods stored locally and merged with built-ins.
- Local persistence with IndexedDB (fallback: localStorage).
- Export:
  - CSV for cycle targets.
  - XLSX (SheetJS) with `CycleTargets`, `DailyPlan`, `Deviations`.
  - Day poster and cycle summary poster as PNG.
- Bilingual UI toggle: English / 中文.

## Project Structure

- `src/App.tsx`: main app UI and state.
- `src/utils/calc.ts`: cycle math and validation.
- `src/utils/solver.ts`: greedy grams solver + totals.
- `src/utils/storage.ts`: IndexedDB/localStorage wrapper.
- `src/utils/export.ts`: CSV/XLSX export.
- `public/foods.json`: built-in foods database.
- `public/manifest.webmanifest`: PWA manifest.
- `public/offline.html`: offline fallback.
- `vite.config.ts`: PWA plugin + Workbox caching rules.

## Local Run

```bash
npm install
npm run dev
```

Open the shown local URL in browser.

## Build

```bash
npm run build
npm run preview
```

## Deploy (Static Hosting)

### GitHub Pages

1. Create repo and push `carbcycler-pwa/`.
2. Build and publish `dist/` using GitHub Actions or manual upload.
3. If serving from a subpath (`https://<user>.github.io/<repo>/`), set Vite `base` in `vite.config.ts` accordingly and set `start_url` in manifest to that base path.

### Cloudflare Pages

1. Create new Pages project from repo.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Deploy.

## iPad Install (Add to Home Screen)

1. Open deployed HTTPS URL in Safari on iPad.
2. Let app fully load once online (this primes offline caches).
3. Tap Share -> **Add to Home Screen**.
4. Launch from home screen as standalone app.

## Offline Notes

- First successful online load is required.
- After install/first load, the app shell and foods database work offline.
- If app updates are deployed, reconnect once so service worker can update cached assets.

