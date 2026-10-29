-- One-time, operator-run cleanup. Never run automatically at application startup.
-- Keep Canadian history (including legacy/duplicate archives); remove all image
-- blobs/mappings and US, GB, JP observations and derived market data.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '30s';
SELECT pg_advisory_xact_lock(817424);
SELECT pg_advisory_xact_lock(817423);
LOCK TABLE ingest_jobs IN EXCLUSIVE MODE;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM ingest_jobs WHERE status = 'pending') THEN
        RAISE EXCEPTION 'Drain pending imports before cleanup';
    END IF;
END $$;
CREATE TEMP TABLE canada_before ON COMMIT DROP AS
SELECT 'products' AS name, count(*) AS rows, sum(hashtextextended(t::text,0)::numeric) AS fingerprint FROM products t WHERE market_code='CA'
UNION ALL SELECT 'stats',count(*),sum(hashtextextended(t::text,0)::numeric) FROM stats t WHERE market_code='CA'
UNION ALL SELECT 'scraper',count(*),sum(hashtextextended(t::text,0)::numeric) FROM scraper t WHERE market_code='CA'
UNION ALL SELECT 'categories',count(*),sum(hashtextextended(t::text,0)::numeric) FROM categories t WHERE market_code='CA';
TABLE canada_before;
TRUNCATE TABLE product_images, images;
TRUNCATE TABLE products_us, products_gb, products_jp;
DELETE FROM stats WHERE market_code IN ('US','GB','JP');
DELETE FROM scraper WHERE market_code IN ('US','GB','JP');
DELETE FROM categories WHERE market_code IN ('US','GB','JP');
CREATE TEMP TABLE canada_after ON COMMIT DROP AS
SELECT 'products' AS name, count(*) AS rows, sum(hashtextextended(t::text,0)::numeric) AS fingerprint FROM products t WHERE market_code='CA'
UNION ALL SELECT 'stats',count(*),sum(hashtextextended(t::text,0)::numeric) FROM stats t WHERE market_code='CA'
UNION ALL SELECT 'scraper',count(*),sum(hashtextextended(t::text,0)::numeric) FROM scraper t WHERE market_code='CA'
UNION ALL SELECT 'categories',count(*),sum(hashtextextended(t::text,0)::numeric) FROM categories t WHERE market_code='CA';
DO $$ BEGIN
    IF EXISTS (SELECT * FROM canada_before EXCEPT SELECT * FROM canada_after) THEN
        RAISE EXCEPTION 'Canada verification failed; rolling back';
    END IF;
END $$;
TABLE canada_after;
SELECT market_code,count(*) FROM products GROUP BY market_code;
SELECT (SELECT count(*) FROM images) AS images, (SELECT count(*) FROM product_images) AS image_mappings;
COMMIT;
