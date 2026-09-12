# Uniqlo Price Tracker

A simple web app for following Uniqlo Canada product prices and viewing their price history.

## Project structure

- `frontend/` — React and Vite web app
- `api/` — Go API backed by PostgreSQL
- `scraper/` — legacy Playwright scraper
- `scraper-api/` — direct storefront API scraper used by GitHub Actions

## Run the frontend

```bash
cd frontend
npm install
npm run dev
```

The app opens at `http://localhost:5173`.

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

## Deployment

Deploy the frontend to Vercel with `frontend` as the project root. Set `VITE_API_URL` to your deployed API URL followed by `/api`.

Keep `VITE_API_URL` available to both builds and Vercel Functions. Product routes
use `api/page.ts` to put their title, description, canonical URL, and sharing
metadata in the initial HTML. The function bundles `dist/index.html`; the app
also updates metadata during client-side navigation. A missing product returns
404 with `noindex`; an unavailable API returns a non-cached 503 app shell.

Deploy the API to a Go-compatible service such as Railway with a PostgreSQL database. Set `DATABASE_URL`, `AUTH_USER`, `AUTH_PASS`, and `CORS_ORIGINS` (your frontend URL).

Run the scraper on a schedule, such as a daily GitHub Actions job. It needs `API_URL`, `AUTH_USER`, and `AUTH_PASS` to upload the latest prices to the API.

The scheduled GitHub workflow records prices daily and downloads product images
on the first day of each month (UTC). New products may have no photo until the
next monthly refresh. Manual runs can opt into image downloads with
`include_images`.

The Go API compresses incoming photos to JPEG quality 80 before database storage,
preserving their pixel dimensions and keeping already smaller JPEGs unchanged.
Existing stored photos are replaced when a later image upload includes them.
