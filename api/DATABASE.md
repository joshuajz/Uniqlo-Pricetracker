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
    image_id BIGSERIAL PRIMARY KEY,
    content_sha256 BYTEA NOT NULL UNIQUE,
    image BYTEA NOT NULL,
    byte_size INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE product_images (
    market_code TEXT NOT NULL,
    product_id TEXT NOT NULL,
    image_id BIGINT NOT NULL REFERENCES images(image_id),
    last_updated DATE NOT NULL,
    PRIMARY KEY (market_code, product_id)
);
```

## Connection

At startup, the API migrates observations to a unique `(product_id, datetime)`
index and adds `scraper.observed_at` (UTC timestamp). Legacy duplicate rows are
copied to `products_duplicate_archive` before removal from active history. Since
legacy rows have no within-day timestamp, the last physical row is retained;
the archive preserves the alternatives for inspection. The migration is atomic
and safe to rerun. Price statistics are recalculated from retained observations.

Each ingest is one complete UTC daily snapshot. The current API requires the
archive metadata to identify the `CA` market and `CAD` currency. A transaction replaces that
day's products and run metadata, updates supplied images and categories, and
recomputes statistics. Any write failure rolls everything back. An advisory lock
serializes uploads; a timestamp older than the stored snapshot returns HTTP 409.
Replaying the same archive does not add observations. Backfills retain their
original recording dates and cannot replace newer images.

## Image storage

Incoming JPEG and PNG photos are validated and compressed in Go before the
ingestion transaction begins. Photos retain their original pixel dimensions and
are encoded as JPEG at quality 80; an already smaller JPEG is retained unchanged.
PNG transparency is composited onto white. Invalid photos, photos larger than
20 MiB, and images exceeding 25 million pixels reject the archive before any
database writes. The image endpoint continues to return `image/jpeg`.

The SHA-256 digest is calculated from the final compressed JPEG. `images` stores
each byte-identical blob once, while `product_images` maps the current market and
product to that blob. Price-only uploads preserve mappings, and older backfills
cannot replace a newer mapping. When a mapping changes, an old blob is removed
only if no other product still references it. The first deployment of this schema
deliberately drops the legacy product-keyed `images` table; those photos are
restored by the next image-enabled scrape.

The scheduled scraper includes photos on the first day of each month (UTC),
while prices continue to update daily. Manual runs can use `include_images`.
Price-only uploads preserve existing photos. Existing database images are not
recompressed at startup; they are replaced when a subsequent image upload
includes them. This also means photos for products absent from future scrapes
are not automatically recompressed.

To measure the same compressor against local downloads without changing the
files or connecting to PostgreSQL, run from `api/`:

```sh
go run ./cmd/image-audit ../scraper/canada/images
```

The command reports byte totals and savings as CSV and decodes every compressed
result to verify its format and dimensions. Multiple country directories can be
passed in one invocation. These are image payload savings, not an estimate of
immediately reclaimable volume space: PostgreSQL also stores table/index
overhead, reusable space from replaced rows, and WAL.

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
