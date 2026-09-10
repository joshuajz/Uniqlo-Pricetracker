# Uniqlo API scraper

This is the direct-API replacement for the Playwright scraper in `scraper/`. It
uses the same public JSON endpoints as Uniqlo Canada's storefront, so it does not
need Chrome or a proxy.

The scraper resolves the site's current taxonomy IDs on every run, queries the
same 23 men, women, and kids category routes as the browser scraper, and follows
pagination until every API listing reported for every category has been received.
It writes the same `prices.json` payload and `output.zip` archive expected by the
existing ingestion endpoint.

## Run

Requires Python 3.10 or newer and has no third-party dependencies.

```bash
cd scraper-api
python -m unittest discover -s tests
python main.py
```

Set `SAVE_PHOTO=true` to include one image per unique product. Useful optional
settings include `MAX_WORKERS`, `API_PAGE_SIZE`, `REQUEST_MAX_ATTEMPTS`, and
`MIN_PRODUCTS`.
