# Database Schema

**PostgreSQL Database:**

```sql
CREATE TABLE products (
    market_code TEXT NOT NULL,
    product_id TEXT NOT NULL,
    name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    currency_code TEXT NOT NULL,
    url TEXT NOT NULL,
    category JSONB NOT NULL,
    datetime DATE NOT NULL,
    PRIMARY KEY (market_code, product_id, datetime)
) PARTITION BY LIST (market_code);

CREATE TABLE products_ca PARTITION OF products FOR VALUES IN ('CA');
CREATE TABLE products_us PARTITION OF products FOR VALUES IN ('US');
CREATE TABLE products_gb PARTITION OF products FOR VALUES IN ('GB');
CREATE TABLE products_jp PARTITION OF products FOR VALUES IN ('JP');

CREATE TABLE scraper (
    market_code TEXT NOT NULL,
    currency_code TEXT NOT NULL,
    datetime DATE NOT NULL,
    scraper_version TEXT NOT NULL,
    total_products INTEGER NOT NULL,
    total_failed INTEGER NOT NULL,
    categories_scraped INTEGER NOT NULL,
    categories TEXT NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (market_code, datetime)
);

CREATE TABLE stats (
    market_code TEXT NOT NULL,
    product_id TEXT NOT NULL,
    lowest_price NUMERIC(10,2) NOT NULL,
    lowest_price_datetime DATE NOT NULL,
    highest_price NUMERIC(10,2) NOT NULL,
    highest_price_datetime DATE NOT NULL,
    regular_price NUMERIC(10,2) NOT NULL,
    PRIMARY KEY (market_code, product_id)
);

CREATE TABLE categories (
    market_code TEXT NOT NULL,
    category TEXT NOT NULL,
    PRIMARY KEY (market_code, category)
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

At startup, the API atomically migrates the Canada-only schema to a partitioned
`products` table. Existing rows are assigned `CA`/`CAD` and copied to
`products_ca`; empty `products_us`, `products_gb`, and `products_jp` partitions
are created for new regional observations. Legacy duplicates remain in
`products_duplicate_archive`, while the retained source tables are renamed to
`products_legacy_ca`, `stats_legacy_ca`, `scraper_legacy_ca`, and
`categories_legacy_ca` for rollback and verification. The migration uses the
same advisory lock as ingestion, runs in one transaction, and is safe to rerun.
Price statistics are recalculated from the migrated observations.

Each ingest is one complete UTC daily snapshot. The current API requires the
archive metadata to identify one supported market/currency pair: `CA`/`CAD`,
`US`/`USD`, `GB`/`GBP`, or `JP`/`JPY`. PostgreSQL routes product rows into the
matching country partition. A transaction replaces only that market's products
and run metadata for the day, updates supplied images and categories, and
recomputes that market's statistics. Any write failure rolls everything back.
An advisory lock serializes imports; a timestamp older than the stored snapshot
for the same market and date fails the job (HTTP 409 on the legacy synchronous
endpoint). Replaying the same archive does
not add observations. Backfills retain their original recording dates and
cannot replace newer images.

The public read endpoints accept a validated country prefix:
`/api/{ca|us|uk|jp}/products`, `/product/:id`, `/product/:id/image`,
`/categories`, and `/category/*category` (all under that same prefix).
`uk` and `gb` both map to the database's `GB` market. Unsupported markets return
404 before querying the database. The legacy unprefixed endpoints remain
Canadian. JSON responses include `market` and `currency`, including empty
catalogues. Every query, statistics join, image lookup, and cache key is
market-scoped. Successful ingestion invalidates read caches; a generation check
prevents an in-flight older read from repopulating an invalidated cache.

No schema migration is needed to enable these regional reads on the existing
partitioned database.

## Durable import jobs

Startup creates `ingest_jobs` if absent. Its SHA-256 primary key identifies the
exact uploaded ZIP, with `pending`, `succeeded`, or `failed` status and an error
for failed imports. `pending` includes both waiting and actively processing jobs.
Both job endpoints require the same Basic Auth as the legacy import endpoint.
Archives are limited to 1 GiB and are streamed to `INGEST_SPOOL_DIR` (default
`/api/database/ingest`), synced, and atomically renamed before the queue row
commits. HTTP 202 is sent only after that commit. The ZIP is read directly from
disk during processing, without loading the whole archive into memory.

The worker holds transaction-scoped advisory lock `817424` through preparation
and persistence, serializing background jobs and preventing another worker from
claiming the same job. Preparation checks the shutdown context between products.
The existing import lock `817423` still serializes database writes with legacy
imports. Product writes and the successful job status commit in **one transaction**.
Validation or persistence errors produce a failed job with no partial import;
connection loss or shutdown rolls back and leaves the job pending for recovery.
An unavailable archive remains pending until its storage is restored. Terminal
payload cleanup runs after the commit and is safe to repeat after a restart.

Use the existing single API replica with the persistent volume mounted at
`/api/database`. Every worker must have access to the same spool; do not scale to
replicas with independent ephemeral disks. Do not configure a short PostgreSQL
`idle_in_transaction_session_timeout`: preparation intentionally holds a queue
transaction while compressing images. Job records are retained for deduplication.
A failed job is terminal; after resolving its cause, run a fresh scrape to submit
a new snapshot. A client polling timeout does not cancel an accepted job.

## Image storage

Incoming JPEG and PNG photos are validated and compressed in Go before product
writes begin. Photos retain their original pixel dimensions and
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
