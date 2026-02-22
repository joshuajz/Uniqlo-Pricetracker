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

The API connects via the `DATABASE_URL` environment variable:

```
DATABASE_URL=postgres://user:password@localhost:5432/uniqlo_tracker?sslmode=disable
```

On Railway, `DATABASE_URL` is automatically set when a PostgreSQL add-on is attached.
