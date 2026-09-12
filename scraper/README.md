# Uniqlo regional API scrapers

The scrapers use the public JSON endpoints that power each Uniqlo storefront.
They do not launch a browser, visit individual product pages, or require a proxy.
One taxonomy request resolves the site's current category IDs, then each category
is downloaded in pages of up to 100 listings. Product images are disabled by
default to keep network traffic low.

## Markets

| Folder | Storefront | Currency | Categories |
| --- | --- | --- | ---: |
| `canada/` | Canada (English) | CAD | 23 |
| `uk/` | United Kingdom | GBP | 23 |
| `japan/` | Japan (Japanese) | JPY | 25 |
| `us/` | United States | USD | 25 |

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
Set `SAVE_PHOTO=true` to include one image per unique product. Optional settings
include `MAX_WORKERS`, `API_PAGE_SIZE`, `REQUEST_MAX_ATTEMPTS`, and
`MIN_PRODUCTS`.

The scheduled Canada workflow uploads prices daily and includes photos only on
the first day of each month (UTC). Manual workflow runs can request photos with
`include_images`. The Go API compresses uploaded photos before storage; local
scraper downloads remain at their original quality.

For a small live API check that fetches only two products:

```bash
python smoke_test.py canada
python smoke_test.py uk
python smoke_test.py japan
python smoke_test.py us
```

## Current ingestion limitation

The application API currently validates Canadian price strings and stores no
market or currency column. Canada archives remain compatible with that endpoint.
The new regional archives include `metadata.market` and `metadata.currency`, but
UK, Japan, and US output must not be sent to the existing ingestion endpoint
until the database/API are made market-aware; product IDs overlap across regions.
