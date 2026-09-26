package main

import (
	"api/internal/productimage"
	"archive/zip"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"regexp"
	"sort"
	"strings"
	"time"
)

var errOlderScrape = errors.New("A newer snapshot already exists for this recording date")

type marketDefinition struct {
	currency     string
	pricePattern *regexp.Regexp
}

var supportedMarkets = map[string]marketDefinition{
	"CA": {currency: "CAD", pricePattern: regexp.MustCompile(`^CA \$ ((?:\d{1,3}(?:,\d{3})*|\d{1,8})(?:\.\d{1,2})?)$`)},
	"US": {currency: "USD", pricePattern: regexp.MustCompile(`^\$((?:\d{1,3}(?:,\d{3})*|\d{1,8})(?:\.\d{1,2})?)$`)},
	"GB": {currency: "GBP", pricePattern: regexp.MustCompile(`^£((?:\d{1,3}(?:,\d{3})*|\d{1,8})(?:\.\d{1,2})?)$`)},
	"JP": {currency: "JPY", pricePattern: regexp.MustCompile(`^¥((?:\d{1,3}(?:,\d{3})*|\d{1,8}))$`)},
}

var supportedMarketCodes = []string{"CA", "US", "GB", "JP"}

type ingestProduct struct {
	Product
	price      string
	categories []string
	image      []byte
	imageHash  [sha256.Size]byte
}
type preparedIngest struct {
	output     ScraperOutput
	observedAt time.Time
	date       string
	market     string
	products   []ingestProduct
}

// Validate the entire archive before product writes. All dates are UTC
// calendar dates, matching the frontend and the direct scraper.
func prepareIngest(output ScraperOutput, images map[string]*zip.File) (preparedIngest, error) {
	return prepareIngestContext(context.Background(), output, images)
}

func prepareIngestContext(ctx context.Context, output ScraperOutput, images map[string]*zip.File) (preparedIngest, error) {
	prepared := preparedIngest{output: output}
	market, supported := supportedMarkets[output.Metadata.Market]
	if !supported {
		return prepared, fmt.Errorf("Unsupported market %q", output.Metadata.Market)
	}
	if output.Metadata.Currency != market.currency {
		return prepared, fmt.Errorf("Market %s requires currency %s", output.Metadata.Market, market.currency)
	}
	prepared.market = output.Metadata.Market
	observedAt, err := time.Parse(time.RFC3339Nano, output.Metadata.Datetime)
	if err != nil {
		return prepared, fmt.Errorf("metadata.datetime must be an RFC3339 timestamp")
	}
	prepared.observedAt = observedAt.UTC()
	prepared.date = prepared.observedAt.Format("2006-01-02")
	byID := map[string]*ingestProduct{}
	categories := make([]string, 0, len(output.Products))
	total := 0
	for category := range output.Products {
		categories = append(categories, category)
	}
	sort.Strings(categories)
	for _, category := range categories {
		if strings.TrimSpace(category) == "" {
			return prepared, fmt.Errorf("Empty category")
		}
		for _, product := range output.Products[category] {
			if err := ctx.Err(); err != nil {
				return prepared, err
			}
			total++
			match := market.pricePattern.FindStringSubmatch(product.Price)
			if len(match) != 2 {
				return prepared, fmt.Errorf("Invalid %s price for product %q", market.currency, product.ProductID)
			}
			price := strings.ReplaceAll(match[1], ",", "")
			if len(strings.SplitN(price, ".", 2)[0]) > 8 {
				return prepared, fmt.Errorf("Invalid %s price for product %q", market.currency, product.ProductID)
			}
			if strings.TrimSpace(product.ProductID) == "" || strings.TrimSpace(product.Name) == "" || strings.TrimSpace(product.URL) == "" {
				return prepared, fmt.Errorf("Product ID, name and URL are required")
			}
			if existing := byID[product.ProductID]; existing != nil {

				existing.categories = append(existing.categories, category)
				continue
			}
			item := &ingestProduct{Product: product, price: price, categories: []string{category}}
			if product.Image != "" {
				file := images[product.Image]
				if file == nil {
					return prepared, fmt.Errorf("Missing image for product %q", product.ProductID)
				}
				r, err := file.Open()
				if err != nil {
					return prepared, err
				}
				original, err := io.ReadAll(io.LimitReader(r, productimage.MaxInputBytes+1))
				r.Close()
				if err != nil {
					return prepared, err
				}
				item.image, err = productimage.Compress(original)
				if err != nil {
					return prepared, fmt.Errorf("Invalid image for product %q: %w", product.ProductID, err)
				}
				item.imageHash = sha256.Sum256(item.image)
			}
			byID[product.ProductID] = item
		}
	}
	if total == 0 || total != output.Metadata.TotalProducts || len(categories) != output.Metadata.CategoriesScraped {
		return prepared, fmt.Errorf("Scrape counts do not match a non-empty archive")
	}
	listed := append([]string(nil), output.Metadata.Categories...)
	sort.Strings(listed)
	if strings.Join(listed, "\x00") != strings.Join(categories, "\x00") {
		return prepared, fmt.Errorf("Scrape categories do not match metadata")
	}
	for _, item := range byID {
		prepared.products = append(prepared.products, *item)
	}
	sort.Slice(prepared.products, func(i, j int) bool { return prepared.products[i].ProductID < prepared.products[j].ProductID })
	return prepared, nil
}

// Recompute from retained observations: replacement/backfill may remove an old
// minimum or change its first date, which incremental min/max updates cannot fix.
const rebuildStatsForMarketSQL = `
WITH frequencies AS (
 SELECT product_id, price, COUNT(*) AS n FROM products WHERE market_code=$1 GROUP BY product_id, price
), modes AS (
 SELECT DISTINCT ON (product_id) product_id, price FROM frequencies ORDER BY product_id, n DESC, price DESC
), lows AS (
 SELECT DISTINCT ON (product_id) product_id, price, datetime FROM products WHERE market_code=$1 ORDER BY product_id, price, datetime
), highs AS (
 SELECT DISTINCT ON (product_id) product_id, price, datetime FROM products WHERE market_code=$1 ORDER BY product_id, price DESC, datetime
)
INSERT INTO stats (market_code, product_id, lowest_price, lowest_price_datetime, highest_price, highest_price_datetime, regular_price)
SELECT $1, l.product_id, l.price, l.datetime, h.price, h.datetime, m.price
FROM lows l JOIN highs h USING (product_id) JOIN modes m USING (product_id)
ON CONFLICT (market_code, product_id) DO UPDATE SET
lowest_price=EXCLUDED.lowest_price, lowest_price_datetime=EXCLUDED.lowest_price_datetime,
highest_price=EXCLUDED.highest_price, highest_price_datetime=EXCLUDED.highest_price_datetime,
regular_price=EXCLUDED.regular_price`

func persistIngest(ctx context.Context, database *sql.DB, prepared preparedIngest) error {
	tx, err := database.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := persistIngestTx(ctx, tx, prepared); err != nil {
		return err
	}
	return tx.Commit()
}

func persistIngestTx(ctx context.Context, tx *sql.Tx, prepared preparedIngest) error {
	var err error
	// Serialize complete snapshots, including competing scheduled/manual runs.
	if _, err = tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(817423)`); err != nil {
		return err
	}
	var latest sql.NullTime
	if err = tx.QueryRowContext(ctx, `SELECT MAX(observed_at) FROM scraper WHERE market_code=$1 AND datetime=$2`, prepared.market, prepared.date).Scan(&latest); err != nil {
		return err
	}
	if latest.Valid && latest.Time.After(prepared.observedAt) {
		return errOlderScrape
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM products WHERE market_code=$1 AND datetime=$2`, prepared.market, prepared.date); err != nil {
		return err
	}
	for _, item := range prepared.products {
		categories, err := json.Marshal(item.categories)
		if err != nil {
			return err
		}
		if _, err = tx.ExecContext(ctx, `INSERT INTO products (market_code,product_id,name,price,currency_code,url,category,datetime) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
			prepared.market, item.ProductID, item.Name, item.price, prepared.output.Metadata.Currency, item.URL, string(categories), prepared.date); err != nil {
			return err
		}
		if len(item.image) > 0 {
			if err = persistProductImage(ctx, tx, prepared.market, prepared.date, item); err != nil {
				return err
			}
		}
	}
	// A changed product photo may leave its previous blob unreferenced. The
	// ingest lock makes it safe to reclaim only blobs with no remaining owner.
	if _, err = tx.ExecContext(ctx, `DELETE FROM images i WHERE NOT EXISTS (
		SELECT 1 FROM product_images pi WHERE pi.image_id=i.image_id
	)`); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM stats s WHERE s.market_code=$1 AND NOT EXISTS (
		SELECT 1 FROM products p WHERE p.market_code=s.market_code AND p.product_id=s.product_id
	)`, prepared.market); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, rebuildStatsForMarketSQL, prepared.market); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM scraper WHERE market_code=$1 AND datetime=$2`, prepared.market, prepared.date); err != nil {
		return err
	}
	m := prepared.output.Metadata
	if _, err = tx.ExecContext(ctx, `INSERT INTO scraper (market_code,currency_code,datetime,scraper_version,total_products,total_failed,categories_scraped,categories,observed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		prepared.market, m.Currency, prepared.date, m.ScraperVersion, m.TotalProducts, m.TotalFailed, m.CategoriesScraped, strings.Join(m.Categories, ","), prepared.observedAt); err != nil {
		return err
	}
	for _, category := range m.Categories {
		if _, err = tx.ExecContext(ctx, `INSERT INTO categories (market_code,category) VALUES ($1,$2) ON CONFLICT DO NOTHING`, prepared.market, category); err != nil {
			return err
		}
	}
	return nil
}

// persistProductImage stores final JPEG bytes once and maps the market-scoped
// product to that shared blob. Older backfills cannot replace a newer mapping.
func persistProductImage(ctx context.Context, tx *sql.Tx, market, date string, item ingestProduct) error {
	var newerMapping bool
	if err := tx.QueryRowContext(ctx, `SELECT EXISTS (
		SELECT 1 FROM product_images
		WHERE market_code=$1 AND product_id=$2 AND last_updated > $3
	)`, market, item.ProductID, date).Scan(&newerMapping); err != nil {
		return err
	}
	if newerMapping {
		return nil
	}

	var imageID int64
	err := tx.QueryRowContext(ctx, `SELECT image_id FROM images WHERE content_sha256=$1 AND image=$2`,
		item.imageHash[:], item.image).Scan(&imageID)
	if errors.Is(err, sql.ErrNoRows) {
		err = tx.QueryRowContext(ctx, `INSERT INTO images (content_sha256,image,byte_size)
			VALUES ($1,$2,$3) RETURNING image_id`, item.imageHash[:], item.image, len(item.image)).Scan(&imageID)
	}
	if err != nil {
		return fmt.Errorf("store image for product %q: %w", item.ProductID, err)
	}

	_, err = tx.ExecContext(ctx, `INSERT INTO product_images (market_code,product_id,image_id,last_updated)
		VALUES ($1,$2,$3,$4)
		ON CONFLICT (market_code,product_id) DO UPDATE SET
		image_id=EXCLUDED.image_id,last_updated=EXCLUDED.last_updated
		WHERE product_images.last_updated <= EXCLUDED.last_updated`,
		market, item.ProductID, imageID, date)
	return err
}

// initializeImageSchema intentionally discards the legacy product-keyed image
// table. Images are recoverable from the scraper, and avoiding a blob copy keeps
// this migration small. The column check makes the reset safe to rerun.
func initializeImageSchema(database *sql.DB) error {
	tx, err := database.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.Exec(`SELECT pg_advisory_xact_lock(817423)`); err != nil {
		return err
	}

	var legacyImages bool
	if err = tx.QueryRow(`SELECT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema=current_schema() AND table_name='images' AND column_name='product_id'
	)`).Scan(&legacyImages); err != nil {
		return err
	}
	if legacyImages {
		if _, err = tx.Exec(`DROP TABLE IF EXISTS product_images`); err != nil {
			return err
		}
		if _, err = tx.Exec(`DROP TABLE images`); err != nil {
			return err
		}
	}

	for _, query := range []string{
		`CREATE TABLE IF NOT EXISTS images (
			image_id BIGSERIAL PRIMARY KEY,
			content_sha256 BYTEA NOT NULL UNIQUE CHECK (octet_length(content_sha256)=32),
			image BYTEA NOT NULL,
			byte_size INTEGER NOT NULL CHECK (byte_size=octet_length(image)),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS product_images (
			market_code TEXT NOT NULL CHECK (market_code IN ('CA','US','GB','JP')),
			product_id TEXT NOT NULL,
			image_id BIGINT NOT NULL REFERENCES images(image_id) ON DELETE RESTRICT,
			last_updated DATE NOT NULL,
			PRIMARY KEY (market_code,product_id)
		)`,
		`CREATE INDEX IF NOT EXISTS product_images_image_id ON product_images (image_id)`,
	} {
		if _, err = tx.Exec(query); err != nil {
			return fmt.Errorf("initialize image schema: %w", err)
		}
	}
	return tx.Commit()
}

// initializeMarketSchema atomically converts the legacy Canada-only tables to
// market-scoped tables. Products remain one logical table to the API, while
// PostgreSQL physically routes rows into one partition per storefront.
func initializeMarketSchema(database *sql.DB) error {
	tx, err := database.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.Exec(`SELECT pg_advisory_xact_lock(817423)`); err != nil {
		return err
	}

	var productsExist, productsPartitioned bool
	if err = tx.QueryRow(`SELECT
		to_regclass('products') IS NOT NULL,
		EXISTS (SELECT 1 FROM pg_partitioned_table WHERE partrelid=to_regclass('products'))
	`).Scan(&productsExist, &productsPartitioned); err != nil {
		return err
	}
	legacyProducts := productsExist && !productsPartitioned
	if legacyProducts {
		hasMarket, err := tableHasColumn(tx, "products", "market_code")
		if err != nil {
			return err
		}
		if hasMarket {
			return fmt.Errorf("products is market-aware but is not partitioned")
		}
		if err = requireAvailableBackupName(tx, "products_legacy_ca"); err != nil {
			return err
		}
		// Current production has a daily unique index. Preserve this cleanup for
		// older installations and archive any duplicate rows before the copy.
		for _, query := range []string{
			`LOCK TABLE products IN ACCESS EXCLUSIVE MODE`,
			`CREATE TABLE IF NOT EXISTS products_duplicate_archive (LIKE products INCLUDING DEFAULTS)`,
			`WITH removed AS (DELETE FROM products a USING products b WHERE a.product_id=b.product_id AND a.datetime=b.datetime AND a.ctid < b.ctid RETURNING a.*) INSERT INTO products_duplicate_archive SELECT * FROM removed`,
			`ALTER TABLE products RENAME TO products_legacy_ca`,
		} {
			if _, err = tx.Exec(query); err != nil {
				return fmt.Errorf("prepare legacy products: %w", err)
			}
		}
	}

	for _, query := range []string{
		`CREATE TABLE IF NOT EXISTS products (
			market_code TEXT NOT NULL DEFAULT 'CA',
			product_id TEXT NOT NULL,
			name TEXT NOT NULL,
			price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
			currency_code TEXT NOT NULL DEFAULT 'CAD',
			url TEXT NOT NULL,
			category JSONB NOT NULL,
			datetime DATE NOT NULL,
			PRIMARY KEY (market_code,product_id,datetime),
			CHECK (
				(market_code='CA' AND currency_code='CAD') OR
				(market_code='US' AND currency_code='USD') OR
				(market_code='GB' AND currency_code='GBP') OR
				(market_code='JP' AND currency_code='JPY')
			)
		) PARTITION BY LIST (market_code)`,
		`CREATE TABLE IF NOT EXISTS products_ca PARTITION OF products FOR VALUES IN ('CA')`,
		`CREATE TABLE IF NOT EXISTS products_us PARTITION OF products FOR VALUES IN ('US')`,
		`CREATE TABLE IF NOT EXISTS products_gb PARTITION OF products FOR VALUES IN ('GB')`,
		`CREATE TABLE IF NOT EXISTS products_jp PARTITION OF products FOR VALUES IN ('JP')`,
		`CREATE INDEX IF NOT EXISTS products_market_recording_date ON products (market_code,datetime DESC)`,
		`CREATE INDEX IF NOT EXISTS products_category_gin ON products USING GIN (category)`,
	} {
		if _, err = tx.Exec(query); err != nil {
			return fmt.Errorf("initialize product partitions: %w", err)
		}
	}
	if legacyProducts {
		if _, err = tx.Exec(`INSERT INTO products (market_code,product_id,name,price,currency_code,url,category,datetime)
			SELECT 'CA',product_id,name,price,'CAD',url,category,datetime FROM products_legacy_ca`); err != nil {
			return fmt.Errorf("migrate Canadian products: %w", err)
		}
	}

	statsExist, err := tableExists(tx, "stats")
	if err != nil {
		return err
	}
	legacyStats := false
	if statsExist {
		legacyStats, err = tableMissingColumn(tx, "stats", "market_code")
		if err != nil {
			return err
		}
	}
	if legacyStats {
		if err = requireAvailableBackupName(tx, "stats_legacy_ca"); err != nil {
			return err
		}
		if _, err = tx.Exec(`ALTER TABLE stats RENAME TO stats_legacy_ca`); err != nil {
			return fmt.Errorf("archive legacy stats: %w", err)
		}
	}
	if _, err = tx.Exec(`CREATE TABLE IF NOT EXISTS stats (
		market_code TEXT NOT NULL DEFAULT 'CA' CHECK (market_code IN ('CA','US','GB','JP')),
		product_id TEXT NOT NULL,
		lowest_price NUMERIC(10,2) NOT NULL,
		lowest_price_datetime DATE NOT NULL,
		highest_price NUMERIC(10,2) NOT NULL,
		highest_price_datetime DATE NOT NULL,
		regular_price NUMERIC(10,2) NOT NULL,
		PRIMARY KEY (market_code,product_id)
	)`); err != nil {
		return fmt.Errorf("initialize market stats: %w", err)
	}

	scraperExist, err := tableExists(tx, "scraper")
	if err != nil {
		return err
	}
	legacyScraper := false
	legacyScraperHasObservedAt := false
	if scraperExist {
		legacyScraper, err = tableMissingColumn(tx, "scraper", "market_code")
		if err != nil {
			return err
		}
		legacyScraperHasObservedAt, err = tableHasColumn(tx, "scraper", "observed_at")
		if err != nil {
			return err
		}
	}
	if legacyScraper {
		if err = requireAvailableBackupName(tx, "scraper_legacy_ca"); err != nil {
			return err
		}
		if _, err = tx.Exec(`ALTER TABLE scraper RENAME TO scraper_legacy_ca`); err != nil {
			return fmt.Errorf("archive legacy scraper runs: %w", err)
		}
	}
	if _, err = tx.Exec(`CREATE TABLE IF NOT EXISTS scraper (
		market_code TEXT NOT NULL DEFAULT 'CA',
		currency_code TEXT NOT NULL DEFAULT 'CAD',
		datetime DATE NOT NULL,
		scraper_version TEXT NOT NULL,
		total_products INTEGER NOT NULL,
		total_failed INTEGER NOT NULL,
		categories_scraped INTEGER NOT NULL,
		categories TEXT NOT NULL,
		observed_at TIMESTAMPTZ NOT NULL,
		PRIMARY KEY (market_code,datetime),
		CHECK (
			(market_code='CA' AND currency_code='CAD') OR
			(market_code='US' AND currency_code='USD') OR
			(market_code='GB' AND currency_code='GBP') OR
			(market_code='JP' AND currency_code='JPY')
		)
	)`); err != nil {
		return fmt.Errorf("initialize market scraper runs: %w", err)
	}
	if legacyScraper {
		copyScraper := `INSERT INTO scraper (market_code,currency_code,datetime,scraper_version,total_products,total_failed,categories_scraped,categories,observed_at)
			SELECT 'CA','CAD',datetime,scraper_version,total_products,total_failed,categories_scraped,categories,
				datetime::timestamp AT TIME ZONE 'UTC'
			FROM (SELECT DISTINCT ON (datetime) * FROM scraper_legacy_ca ORDER BY datetime,ctid DESC) legacy`
		if legacyScraperHasObservedAt {
			copyScraper = `INSERT INTO scraper (market_code,currency_code,datetime,scraper_version,total_products,total_failed,categories_scraped,categories,observed_at)
				SELECT 'CA','CAD',datetime,scraper_version,total_products,total_failed,categories_scraped,categories,
					COALESCE(observed_at,datetime::timestamp AT TIME ZONE 'UTC')
				FROM (SELECT DISTINCT ON (datetime) * FROM scraper_legacy_ca ORDER BY datetime,observed_at DESC NULLS LAST,ctid DESC) legacy`
		}
		if _, err = tx.Exec(copyScraper); err != nil {
			return fmt.Errorf("migrate Canadian scraper runs: %w", err)
		}
	}

	categoriesExist, err := tableExists(tx, "categories")
	if err != nil {
		return err
	}
	legacyCategories := false
	if categoriesExist {
		legacyCategories, err = tableMissingColumn(tx, "categories", "market_code")
		if err != nil {
			return err
		}
	}
	if legacyCategories {
		if err = requireAvailableBackupName(tx, "categories_legacy_ca"); err != nil {
			return err
		}
		if _, err = tx.Exec(`ALTER TABLE categories RENAME TO categories_legacy_ca`); err != nil {
			return fmt.Errorf("archive legacy categories: %w", err)
		}
	}
	if _, err = tx.Exec(`CREATE TABLE IF NOT EXISTS categories (
		market_code TEXT NOT NULL DEFAULT 'CA' CHECK (market_code IN ('CA','US','GB','JP')),
		category TEXT NOT NULL,
		PRIMARY KEY (market_code,category)
	)`); err != nil {
		return fmt.Errorf("initialize market categories: %w", err)
	}
	if legacyCategories {
		if _, err = tx.Exec(`INSERT INTO categories (market_code,category)
			SELECT 'CA',category FROM categories_legacy_ca ON CONFLICT DO NOTHING`); err != nil {
			return fmt.Errorf("migrate Canadian categories: %w", err)
		}
	}

	if legacyProducts || legacyStats || !statsExist {
		if _, err = tx.Exec(`DELETE FROM stats`); err != nil {
			return err
		}
		for _, market := range supportedMarketCodes {
			if _, err = tx.Exec(rebuildStatsForMarketSQL, market); err != nil {
				return fmt.Errorf("rebuild %s stats: %w", market, err)
			}
		}
	}
	return tx.Commit()
}

func tableExists(tx *sql.Tx, table string) (bool, error) {
	var exists bool
	err := tx.QueryRow(`SELECT EXISTS (
		SELECT 1 FROM information_schema.tables
		WHERE table_schema=current_schema() AND table_name=$1
	)`, table).Scan(&exists)
	return exists, err
}

func tableHasColumn(tx *sql.Tx, table, column string) (bool, error) {
	var exists bool
	err := tx.QueryRow(`SELECT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema=current_schema() AND table_name=$1 AND column_name=$2
	)`, table, column).Scan(&exists)
	return exists, err
}

func tableMissingColumn(tx *sql.Tx, table, column string) (bool, error) {
	exists, err := tableHasColumn(tx, table, column)
	return !exists, err
}

func requireAvailableBackupName(tx *sql.Tx, table string) error {
	exists, err := tableExists(tx, table)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("cannot migrate: backup table %s already exists", table)
	}
	return nil
}
