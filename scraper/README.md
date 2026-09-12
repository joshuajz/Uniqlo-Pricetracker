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

Regional workflows run once per UTC day without overlapping:

| Market | Daily start time (UTC) |
| --- | --- |
| Canada | 00:00 |
| United Kingdom | 02:15 |
| Japan | 04:30 |
| United States | 06:45 |

Every market includes photos on the first UTC day of the month. Each workflow
also supports a manual run with the `include_images` option.

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
