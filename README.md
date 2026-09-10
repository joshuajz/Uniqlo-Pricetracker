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

Deploy the API to a Go-compatible service such as Railway with a PostgreSQL database. Set `DATABASE_URL`, `AUTH_USER`, `AUTH_PASS`, and `CORS_ORIGINS` (your frontend URL).

Run the scraper on a schedule, such as a daily GitHub Actions job. It needs `API_URL`, `AUTH_USER`, and `AUTH_PASS` to upload the latest prices to the API.
