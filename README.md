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

To test against the public production catalogue without a local database:

```bash
cd frontend
DEV_API_ORIGIN=https://api.uniqlotracker.com npm run dev
```

This proxies public catalogue, history, and image reads through the local dev server.
Without `DEV_API_ORIGIN`, the proxy continues to use the local API at port 8080.

## Find a product by link

The browse search accepts names, product IDs, and product-page URLs from Uniqlo
Canada, the US, the UK, and Japan. Names and IDs filter as you type. Pasting a
link shows its country and full product ID; press Enter or **View history** to
open the matching history directly, regardless of the browse filters or current
country. The edition suffix (for example `E465185-001`) remains part of the ID.
Links may omit `https://`; colour query parameters and fragments do not change
the product match. Category pages and unsupported countries show guidance.

A product with no recorded history shows **No price history yet**, with a link
back to Uniqlo. Looking up a link does not start tracking or fetch older prices.
Temporary API errors continue to offer a retry rather than claiming the product
has no history.

After deploying this change, users can also replace `uniqlo` with
`uniqlotracker` in a supported product URL:

```text
https://www.uniqlo.com/ca/en/products/E465185-000/00
https://www.uniqlotracker.com/ca/en/products/E465185-000/00
→ https://www.uniqlotracker.com/ca/products/E465185-000
```

The existing Vercel page handler issues a permanent HTTP redirect; the React
router also supports the shortcut during local development. No new domain is
needed for `www.uniqlotracker.com`. The domain must serve this frontend and
preserve incoming paths (including when redirecting an apex domain to `www`).

## Run the API

The API needs PostgreSQL and these environment variables: `DATABASE_URL`, `AUTH_USER`, and `AUTH_PASS`.
Set `INGEST_SPOOL_DIR` to a writable directory for local development. In production
it must be on persistent storage; the default `/api/database/ingest` uses the
existing Railway volume mounted at `/api/database`.

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
metadata in the initial HTML, together with a readable product name, recorded
price, typical and lowest prices, recording dates, and store link. The interactive
React app replaces this content when it mounts. The function bundles
`dist/index.html`; the app also updates metadata during client-side navigation. A missing product returns
404 with `noindex`; an unavailable API returns a non-cached 503 app shell.

`/sitemap.xml` is a live sitemap index containing the general pages in
`/sitemap-pages.xml` and regional product sitemaps at
`/sitemap-products-<market>-<page>.xml`. Each product sitemap contains up to
10,000 sorted, unique canonical URLs from that market's latest catalogue.
Archived products retain their working detail pages but are not listed in the
current-catalogue sitemaps. Successful sitemap responses are cached for five
minutes; API failures return a non-cached 503 instead of incomplete XML.
`robots.txt` continues to advertise `/sitemap.xml`. No rebuild is required when
the catalogue changes. Verify the index and one product sitemap per market
after deploying the frontend.

Deploy the API to a Go-compatible service such as Railway with a PostgreSQL database. Set `DATABASE_URL`, `AUTH_USER`, `AUTH_PASS`, and `CORS_ORIGINS` (your frontend URL).

Run the Canada scraper on a schedule, such as the included daily GitHub Actions
job. It needs `API_URL`, `AUTH_USER`, and `AUTH_PASS` to upload the latest prices
to the API. The ingestion endpoint also accepts the UK, Japan, and US archives
and routes their observations into separate PostgreSQL product partitions. Public reads use `/api/ca`, `/api/us`, `/api/uk`, and `/api/jp` prefixes.
Unprefixed API routes continue to return Canada for compatibility.

The scheduled GitHub workflows record prices and fill missing product images
daily in every market. All product images are refreshed on the first day of each
month (UTC). Manual runs also fill missing images; `include_images` requests a
full refresh. Failed image downloads are retried on the next daily run.

The Go API compresses incoming photos to JPEG quality 80 before database storage,
preserving their pixel dimensions and keeping already smaller JPEGs unchanged.
Existing stored photos are replaced when a later image upload includes them.

All four workflows use `python upload.py <country>/output.zip` from `scraper/`.
The client streams the archive to `POST /api/ingest/jobs` with Basic Auth and
`Content-Type: application/zip`, then polls `GET /api/ingest/jobs/<sha256>`.
`API_URL` is the server origin (default `https://api.uniqlotracker.com`). An HTTP
202 means the archive is durably queued; the workflow succeeds only when the
job reports `succeeded`. It reports `failed` jobs immediately and waits up to
45 minutes for queued work; the workflow budget is 60 minutes including scraping.
Connection failures retry the same content-addressed job. Re-running the upload
client with the same archive resumes polling without creating a duplicate import.

Deploy the API with its persistent volume **before running the updated workflows**.
The API adds the `ingest_jobs` table automatically. Its worker imports one job at
a time, outside the upload request, and automatically retries unfinished jobs
after a process or database restart. Completed archives are removed; small job
records remain for status checks and deduplication. The existing synchronous
`/api/products/injest` route remains available for older clients, but large
image imports should use the job endpoints to avoid HTTP timeouts.

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
for Canada. Daily regional workflows now fill missing photos automatically; `include_images`
can request an immediate full refresh. Until a regional import runs, the UI
uses its image-unavailable placeholder. Deal counts may be small with short
histories; all tracked products are still available in All products.
