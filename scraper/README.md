# Uniqlo regional API scrapers

The scrapers use the public JSON endpoints that power each Uniqlo storefront.
They do not launch a browser, visit individual product pages, or require a proxy.
One taxonomy request resolves the site's current category IDs, then each category
is downloaded in pages of up to 100 listings. Product images are disabled by
default to keep network traffic low.

## Markets

| Folder | Storefront | Currency | Categories |
| --- | --- | --- | ---: |
| `canada/` | Canada (English) | CAD | 27 |
| `uk/` | United Kingdom | GBP | 25 |
| `japan/` | Japan (Japanese) | JPY | 28 |
| `us/` | United States | USD | 29 |

All markets cover men, women, kids, and baby, including newborn and toddler
listings. Canada also includes women's dresses and skirts and men's UV
protection; Japan includes flowers; the US includes women's linen and kids'
girls collections to capture products missing from its standard categories.

The shared implementation lives in `core.py`; each market folder contains only
the routes and storefront settings that differ. This keeps retry, pagination,
validation, archive, and image behavior consistent across countries.

## Run

Python 3.10 or newer is required. There are no third-party dependencies.

```bash
cd scraper
python -m unittest discover -s tests
python canada/main.py
python uk/main.py
python japan/main.py
python us/main.py
```

Each command writes `prices.json` and `output.zip` in its own country folder.
Set `SAVE_PHOTO=true` to refresh one image per unique product, or
`SAVE_MISSING_PHOTO=true` to download only images absent from the application API
(using `API_URL`, defaulting to `https://api.uniqlotracker.com`). Full refresh takes
precedence when both are enabled. Optional settings
include `MAX_WORKERS`, `API_PAGE_SIZE`, `REQUEST_MAX_ATTEMPTS`, and
`MIN_PRODUCTS`.

Every scheduled workflow uploads prices and fills missing photos daily, including
new arrivals and retries of failed downloads. Stored image IDs are checked once
per market through `/api/:market/product-images`; products missing from the latest
price snapshot still retain their images. If the inventory is unavailable or
invalid, the scraper downloads all images so prices and new photos can still be
imported. All photos are refreshed on the first day of each month (UTC). Manual
workflow runs fill missing photos and can request a full refresh with
`include_images`. The Go API compresses uploaded photos before storage; local
scraper downloads remain at their original quality.

Regional workflows run once per UTC day without overlapping:

| Market | Daily start time (UTC) |
| --- | --- |
| Canada | 00:00 |
| United Kingdom | 02:15 |
| Japan | 04:30 |
| United States | 06:45 |

Every market refreshes all photos on the first UTC day of the month. Each workflow
also supports a manual full refresh with the `include_images` option.

For a small live API check that fetches only two products:

```bash
python smoke_test.py canada
python smoke_test.py uk
python smoke_test.py japan
python smoke_test.py us
```

## Regional ingestion

The application API validates each archive's `metadata.market`, currency, and
market-specific price format. Canada, UK, Japan, and US archives can all use the
same ingestion endpoint; their product histories, statistics, categories, run
metadata, and image mappings are isolated by market. Public read endpoints still
return Canada until the frontend market selector is connected to the API.
