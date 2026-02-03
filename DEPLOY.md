# Deployment Plan

## Architecture

| Component | Service | Cost |
|-----------|---------|------|
| Frontend | Vercel (free Hobby tier) | $0 |
| API | Railway ($5/mo Hobby plan) | $5/mo |
| Scraper | GitHub Actions cron (free for public repos) | $0 |
| Domain | uniqlotracker.com (or similar) | ~$10/yr |
| **Total** | | **~$5/mo** |

## 1. Frontend — Vercel

- Connect GitHub repo to Vercel
- Settings:
  - **Root directory:** `frontend`
  - **Framework preset:** Vite
  - **Build command:** `npm run build`
  - **Output directory:** `dist`
- Environment variables:
  - `VITE_API_URL` = `https://api.uniqlotracker.com` (your Railway API URL)
- Update `frontend/src/lib/api.ts` to use `import.meta.env.VITE_API_URL` as the base URL
- Add custom domain in Vercel dashboard

## 2. API — Railway

- Connect GitHub repo to Railway
- Settings:
  - **Root directory:** `api`
  - Railway auto-detects Go via Nixpacks
- Environment variables:
  - `PORT` is set automatically by Railway
- **Database:** Attach a persistent volume at `/app/database/` for `products.db`
- **Custom domain:** Add `api.uniqlotracker.com` in Railway settings
- **CORS:** Configure the Go API to allow requests from your Vercel frontend domain

### Key fix applied
The API was binding to `localhost:8080` which prevents Railway's proxy from reaching it. Changed to `0.0.0.0:$PORT`.

## 3. Scraper — GitHub Actions

Create `.github/workflows/scrape.yml`:

```yaml
name: Daily Scrape

on:
  schedule:
    - cron: '0 3 * * *'  # 3:00 AM UTC daily
  workflow_dispatch:       # manual trigger for testing

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install uv
        run: pip install uv

      - name: Install dependencies
        run: cd scraper && uv sync

      - name: Install Chrome
        uses: browser-actions/setup-chrome@v1

      - name: Run scraper
        run: cd scraper && uv run main.py

      - name: Upload results to API
        run: |
          curl -X POST "${{ secrets.API_URL }}/api/products/injest" \
            -u "${{ secrets.API_AUTH }}" \
            -F "file=@scraper/output.zip"
```

### GitHub Secrets to configure
- `API_URL` — Railway API URL (e.g. `https://api.uniqlotracker.com`)
- `API_AUTH` — Basic auth credentials (e.g. `admin:password` — change this!)

## 4. Data Flow

```
GitHub Actions (cron daily)
  → Scraper runs, produces ZIP with prices.json + images
  → POST /api/products/injest to Railway API
  → API ingests into SQLite products.db
  → Frontend fetches from /api/products
```

## TODO

- [ ] Update `frontend/src/lib/api.ts` to use `VITE_API_URL` env var
- [ ] Add CORS middleware to Go API
- [ ] Change basic auth credentials for `/api/products/injest`
- [ ] Set up Vercel project + custom domain
- [ ] Set up Railway project + persistent volume + custom domain
- [ ] Create GitHub Actions workflow file
- [ ] Add GitHub secrets (API_URL, API_AUTH)
- [ ] Buy domain and configure DNS
- [ ] Test end-to-end: scraper → API → frontend
