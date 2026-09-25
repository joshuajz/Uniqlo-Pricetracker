# Uniqlo Price Tracker

A simple web app for following Uniqlo product prices in Canada, the US, the UK, and Japan and viewing their price history.

## Project structure

- `frontend/` — React and Vite web app
- `api/` — Go API backed by PostgreSQL
- `scraper/` — low-traffic storefront API scrapers for Canada, the UK, Japan,
  and the US

## Run the frontend

```bash
cd frontend
npm install
npm run dev
```

The app opens at `http://localhost:5174`.

## Run the API

The API needs PostgreSQL and these environment variables: `DATABASE_URL`, `AUTH_USER`, and `AUTH_PASS`.

```bash
cd api
go run .
```

It runs on `http://localhost:8080` by default.

To point the frontend at it, start the frontend with:

```bash
VITE_API_URL=http://localhost:8080/api npm run dev
```

## Checks

Run the frontend tests and production build:

```bash
cd frontend
npm test
npm run build
```

Run the API checks from `api/` with `go test -race ./...` and `go vet ./...`.
Database tests require `TEST_DATABASE_URL` pointing to a disposable PostgreSQL
database; otherwise they skip. See [database testing](api/DATABASE.md).

Run the scraper tests from `scraper/` with `python -m unittest discover -s tests`.
CI runs all three suites and provides PostgreSQL for the API tests.

## Deployment

Deploy the frontend to Vercel with `frontend` as the project root. Set `VITE_API_URL` to your deployed API URL followed by `/api`.

Keep `VITE_API_URL` available to both builds and Vercel Functions. Product routes
use `api/page.ts` to put their title, description, canonical URL, and sharing
metadata in the initial HTML. The function bundles `dist/index.html`; the app
also updates metadata during client-side navigation. A missing product returns
404 with `noindex`; an unavailable API returns a non-cached 503 app shell.

Deploy the API to a Go-compatible service such as Railway with a PostgreSQL database. Set `DATABASE_URL`, `AUTH_USER`, `AUTH_PASS`, and `CORS_ORIGINS` (your frontend URL).

Run the Canada scraper on a schedule, such as the included daily GitHub Actions
job. It needs `API_URL`, `AUTH_USER`, and `AUTH_PASS` to upload the latest prices
to the API. The ingestion endpoint also accepts the UK, Japan, and US archives
and routes their observations into separate PostgreSQL product partitions. Public reads use `/api/ca`, `/api/us`, `/api/uk`, and `/api/jp` prefixes.
Unprefixed API routes continue to return Canada for compatibility.

The scheduled GitHub workflow records prices daily and downloads product images
on the first day of each month (UTC). New products may have no photo until the
next monthly refresh. Manual runs can opt into image downloads with
`include_images`.

The Go API compresses incoming photos to JPEG quality 80 before database storage,
preserving their pixel dimensions and keeping already smaller JPEGs unchanged.
Existing stored photos are replaced when a later image upload includes them.

## Country selection and rollout

The site uses `/ca`, `/us`, `/uk`, and `/jp`, with catalogue and product links
under each country (for example `/jp/products/E123456-000`). `/gb` is an alias
that redirects to `/uk`; the database continues to use the ISO code `GB`.
The country in a URL always wins. Visits to `/` redirect in the browser to the
country saved in `localStorage` (`uniqlo-market`), or Canada when no valid
preference is available. Storage failures also default to Canada. Old unprefixed
links such as `/products/E123456-000` remain Canadian and redirect to `/ca/...`.

The selector preserves the page type but clears country-specific filters.
From a product page it opens the new country's catalogue: product IDs are not
assumed to identify equivalent items across storefronts. Lists, history,
images, statistics, caches, currency formatting, and sharing metadata are all
scoped to the country. Prices use the storefront's currency; no conversion is
performed. Japanese product names remain in the source language.

Deploy the API before the frontend. The database is already partitioned for
all four markets, so enabling the public regional reads needs no new data
migration. Deploy `frontend` with the included Vercel rewrites so direct loads
and shared links use the regional HTML metadata handler. Verify `/ca`, `/us`,
`/uk`, `/jp`, a product deep link, and the `/` saved-country redirect after
publishing. Root preference redirects require JavaScript; `localStorage` is
not available to the server.

Before launch, check image coverage for each market. The September 25 review
found regional price history starting September 13, but stored images only
for Canada. Trigger each regional workflow with `include_images` to populate
photos ahead of the normal first-of-month image refresh. Until then the UI
uses its image-unavailable placeholder. Deal counts may be small with short
histories; all tracked products are still available in All products.
