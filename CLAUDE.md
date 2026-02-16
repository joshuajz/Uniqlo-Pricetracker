# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Uniqlo Price Tracker - A multi-component application for tracking Uniqlo product prices. The project consists of four separate parts:

1. **Frontend** (`frontend/`) - React 19 + TypeScript + Vite web application using shadcn/ui and Tailwind CSS
2. **Mock Server** (`frontend/mock/`) - Express.js mock API server for frontend development
3. **API** (`api/`) - Go backend using Gin web framework with PostgreSQL
4. **Scraper** (`scraper/`) - Python Selenium-based web scraper for Uniqlo product data

## Commands

### Frontend (React/Vite)
```bash
cd frontend
npm run dev      # Start development server with HMR (localhost:5173)
npm run build    # TypeScript compile + Vite production build
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

### Mock Server (Express)
```bash
cd frontend/mock
npm start        # Start mock API server (localhost:3001)
npm run dev      # Start with auto-reload
```

### API (Go/Gin)
```bash
cd api
go run main.go   # Run the API server (localhost:8080)
go build         # Build the API binary
```

Requires `DATABASE_URL` environment variable:
```bash
DATABASE_URL=postgres://user:password@localhost:5432/uniqlo_tracker?sslmode=disable
```

### Scraper (Python/Selenium)
```bash
cd scraper
uv sync          # Install dependencies using uv
uv run main.py   # Run the scraper
```

## Environment Variables

| Variable | Component | Description |
|----------|-----------|-------------|
| `DATABASE_URL` | API | PostgreSQL connection string (required) |
| `AUTH_USER` | API | Basic auth username for ingest endpoint (required) |
| `AUTH_PASS` | API | Basic auth password for ingest endpoint (required) |
| `PORT` | API | Server port (default: 8080) |
| `CORS_ORIGINS` | API | Comma-separated allowed origins (default: http://localhost:5173) |
| `VITE_API_URL` | Frontend | API base URL for production builds |

## Development Workflow

For frontend development, run both the mock server and frontend:

```bash
# Terminal 1: Start mock API
cd frontend/mock && npm start

# Terminal 2: Start frontend
cd frontend && npm run dev
```

The frontend proxies `/api` requests to localhost:3001 automatically.

For API development, ensure PostgreSQL is running locally:

```bash
# Set DATABASE_URL, AUTH_USER, AUTH_PASS then:
cd api && go run main.go
```

## Architecture

- **Frontend**: Uses React Router for navigation, shadcn/ui components, Recharts for price graphs, and Tailwind CSS v4 for styling. Entry point is `frontend/src/main.tsx`.
- **Mock Server**: Express.js server serving mock product data from JSON files in `frontend/mock/data/`.
- **API**: Gin REST API backed by PostgreSQL. Uses JSONB for categories, BYTEA for product images, TIMESTAMPTZ for timestamps. Single connection pool created at startup.
- **Scraper**: Uses Selenium WebDriver to scrape Uniqlo product pages. Has `DEBUG_MODE` flag for screenshot capture during development. Uses uv for Python package management.

## Tech Stack

- Frontend: React 19, TypeScript 5.9, Vite 7, shadcn/ui, Tailwind CSS 4, Recharts, React Router
- Mock Server: Node.js, Express.js
- API: Go 1.25, Gin, PostgreSQL (lib/pq)
- Scraper: Python 3.10+, Selenium, uv

## Frontend Structure

```
frontend/src/
├── components/
│   ├── ui/              # shadcn/ui components (Button, Card, Input, etc.)
│   ├── Navbar.tsx       # Site navigation
│   ├── Footer.tsx       # Site footer
│   ├── ProductCard.tsx  # Product grid card
│   ├── PriceChart.tsx   # Recharts price history graph
│   └── NotificationForm.tsx  # Email subscription form
├── pages/
│   ├── HomePage.tsx     # Main product listing
│   ├── ProductPage.tsx  # Individual product details
│   └── SearchPage.tsx   # Search results
├── lib/
│   ├── api.ts           # API client functions
│   └── utils.ts         # Utility functions (cn, formatPrice, etc.)
├── types/
│   └── index.ts         # TypeScript interfaces
├── App.tsx              # Main app with routing
├── main.tsx             # Entry point
└── index.css            # Tailwind CSS + theme variables
```

## API Endpoints (Mock Server)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/stats` | GET | Dashboard statistics |
| `/api/products` | GET | List all products (paginated) |
| `/api/products/search?q=` | GET | Search products |
| `/api/products/:id` | GET | Get single product |
| `/api/products/:id/history` | GET | Get price history |
| `/api/categories` | GET | List all categories |
| `/api/categories/:slug` | GET | Get products by category |
| `/api/subscriptions` | POST | Create email subscription |
| `/api/subscriptions/:id` | DELETE | Remove subscription |
