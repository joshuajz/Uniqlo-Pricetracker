# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Uniqlo Price Tracker - A multi-component application for tracking Uniqlo product prices. The project consists of three separate parts:

1. **Frontend** (root) - React 19 + TypeScript + Vite web application using Ant Design UI
2. **API** (`api/`) - Go backend using Gin web framework
3. **Scraper** (`scraper/`) - Python Selenium-based web scraper for Uniqlo product data

## Commands

### Frontend (React/Vite)
```bash
npm run dev      # Start development server with HMR
npm run build    # TypeScript compile + Vite production build
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

### API (Go/Gin)
```bash
cd api
go run main.go   # Run the API server (localhost:8080)
go build         # Build the API binary
```

### Scraper (Python/Selenium)
```bash
cd scraper
uv sync          # Install dependencies using uv
uv run main.py   # Run the scraper
```

## Architecture

- **Frontend**: Uses React Compiler (babel-plugin-react-compiler) for automatic optimizations. Entry point is `src/main.tsx`.
- **API**: Simple Gin REST API. Currently has a sample `/albums` endpoint as boilerplate.
- **Scraper**: Uses Selenium WebDriver to scrape Uniqlo product pages. Has `DEBUG_MODE` flag for screenshot capture during development. Uses uv for Python package management.

## Tech Stack

- Frontend: React 19, TypeScript 5.9, Vite 7, Ant Design 6
- API: Go 1.25, Gin
- Scraper: Python 3.10+, Selenium, uv
