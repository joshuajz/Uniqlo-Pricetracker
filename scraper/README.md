# Uniqlo regional API scrapers

The scrapers use the public JSON endpoints that power each Uniqlo storefront.
They do not launch a browser, visit individual product pages, or require a proxy.
One taxonomy request resolves the site's current category IDs, then each category
is downloaded in pages of up to 100 listings. Product images are never downloaded or included in archives.

## Markets

| Folder | Storefront | Currency | Categories |
| --- | --- | --- | ---: |
| `canada/` | Canada (English) | CAD | 27 |
| `uk/` | United Kingdom | GBP | 25 |
| `japan/` | Japan (Japanese) | JPY | 28 |
| `us/` | United States | USD | 28 |

All markets cover men, women, kids, and baby, including newborn and toddler
listings. Canada also includes women's dresses and skirts and men's UV
protection; Japan includes flowers; the US includes women's linen and kids'
girls collections to capture products missing from its standard categories.

The shared implementation lives in `core.py`; each market folder contains only
the routes and storefront settings that differ. This keeps retry, pagination,
validation and archive behavior consistent across countries.

One observation is retained per product ID. When multiple price groups are
listed, the scraper prefers primary group `00`, then the lowest available group
code; within a group, the lowest listed price breaks ties. Selection is consistent
across pages and categories, so listing order cannot create a price change. Every
category uses the selected group's price and product URL. Archives retain
the `price_group` field for inspection; existing historical observations are not
rewritten.

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
Archives contain only `prices.json`. Old image environment flags have no effect,
and leftover local image files are not packaged. Optional settings include
`MAX_WORKERS`, `API_PAGE_SIZE`, `REQUEST_MAX_ATTEMPTS`, and `MIN_PRODUCTS`.

Only the Canada workflow is currently enabled in GitHub. Other regional workflows
and the regional smoke-test workflow are disabled.

Regional workflows run once per UTC day without overlapping:

| Market | Daily start time (UTC) |
| --- | --- |
| Canada | 00:00 |
| United Kingdom | 02:15 |
| Japan | 04:30 |
| United States | 06:45 |

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
