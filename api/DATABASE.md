# Database Schema

**PostgreSQL Database:**

```sql
CREATE TABLE products (
    product_id TEXT NOT NULL,
    name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    url TEXT NOT NULL,
    category JSONB NOT NULL,
    datetime DATE NOT NULL
);

CREATE TABLE scraper (
    datetime DATE NOT NULL,
    scraper_version TEXT NOT NULL,
    total_products INTEGER NOT NULL,
    total_failed INTEGER NOT NULL,
    categories_scraped INTEGER NOT NULL,
    categories TEXT NOT NULL
);

CREATE TABLE stats (
    product_id TEXT NOT NULL UNIQUE,
    lowest_price NUMERIC(10,2) NOT NULL,
    lowest_price_datetime DATE NOT NULL,
    highest_price NUMERIC(10,2) NOT NULL,
    highest_price_datetime DATE NOT NULL,
    regular_price NUMERIC(10,2) NOT NULL
);

CREATE TABLE images (
    product_id TEXT NOT NULL UNIQUE,
    image BYTEA NOT NULL,
    last_updated DATE DEFAULT NOW()
);
```

## Connection

At startup, the API migrates observations to a unique `(product_id, datetime)`
index and adds `scraper.observed_at` (UTC timestamp). Legacy duplicate rows are
copied to `products_duplicate_archive` before removal from active history. Since
legacy rows have no within-day timestamp, the last physical row is retained;
the archive preserves the alternatives for inspection. The migration is atomic
and safe to rerun. Price statistics are recalculated from retained observations.

Each ingest is one complete UTC daily snapshot. A transaction replaces that
day's products and run metadata, updates supplied images and categories, and
recomputes statistics. Any write failure rolls everything back. An advisory lock
serializes uploads; a timestamp older than the stored snapshot returns HTTP 409.
Replaying the same archive does not add observations. Backfills retain their
original recording dates and cannot replace newer images.

Run database regression tests against a disposable PostgreSQL instance:

```sh
TEST_DATABASE_URL=postgres://user:password@localhost:5432/test_db?sslmode=disable go test -race ./...
```

Tests create and remove their own schemas. Without `TEST_DATABASE_URL`, the
database tests skip; pure validation tests still run. CI supplies PostgreSQL.

The API connects via the `DATABASE_URL` environment variable:

```
DATABASE_URL=postgres://user:password@localhost:5432/uniqlo_tracker?sslmode=disable
```

On Railway, `DATABASE_URL` is automatically set when a PostgreSQL add-on is attached.
