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
var pricePattern = regexp.MustCompile(`^CA \$ (\d{1,8}(?:\.\d{1,2})?)$`)

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

// Validate the entire archive before opening a transaction. All dates are UTC
// calendar dates, matching the frontend and the direct scraper.
func prepareIngest(output ScraperOutput, images map[string]*zip.File) (preparedIngest, error) {
	prepared := preparedIngest{output: output}
	if output.Metadata.Market != currentMarketCode || output.Metadata.Currency != currentCurrencyCode {
		return prepared, fmt.Errorf("Only %s/%s scraper archives are currently supported", currentMarketCode, currentCurrencyCode)
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
			total++
			match := pricePattern.FindStringSubmatch(product.Price)
			if len(match) != 2 {
				return prepared, fmt.Errorf("Invalid CAD price for product %q", product.ProductID)
			}
			if strings.TrimSpace(product.ProductID) == "" || strings.TrimSpace(product.Name) == "" || strings.TrimSpace(product.URL) == "" {
				return prepared, fmt.Errorf("Product ID, name and URL are required")
			}
			if existing := byID[product.ProductID]; existing != nil {

				existing.categories = append(existing.categories, category)
				continue
			}
			item := &ingestProduct{Product: product, price: match[1], categories: []string{category}}
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
const rebuildStatsSQL = `
WITH frequencies AS (
 SELECT product_id, price, COUNT(*) AS n FROM products GROUP BY product_id, price
), modes AS (
 SELECT DISTINCT ON (product_id) product_id, price FROM frequencies ORDER BY product_id, n DESC, price DESC
), lows AS (
 SELECT DISTINCT ON (product_id) product_id, price, datetime FROM products ORDER BY product_id, price, datetime
), highs AS (
 SELECT DISTINCT ON (product_id) product_id, price, datetime FROM products ORDER BY product_id, price DESC, datetime
)
INSERT INTO stats (product_id, lowest_price, lowest_price_datetime, highest_price, highest_price_datetime, regular_price)
SELECT l.product_id, l.price, l.datetime, h.price, h.datetime, m.price
FROM lows l JOIN highs h USING (product_id) JOIN modes m USING (product_id)
ON CONFLICT (product_id) DO UPDATE SET
lowest_price=EXCLUDED.lowest_price, lowest_price_datetime=EXCLUDED.lowest_price_datetime,
highest_price=EXCLUDED.highest_price, highest_price_datetime=EXCLUDED.highest_price_datetime,
regular_price=EXCLUDED.regular_price`

func persistIngest(ctx context.Context, database *sql.DB, prepared preparedIngest) error {
	tx, err := database.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	// Serialize complete snapshots, including competing scheduled/manual runs.
	if _, err = tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(817423)`); err != nil {
		return err
	}
	var latest sql.NullTime
	if err = tx.QueryRowContext(ctx, `SELECT MAX(observed_at) FROM scraper WHERE datetime=$1`, prepared.date).Scan(&latest); err != nil {
		return err
	}
	if latest.Valid && latest.Time.After(prepared.observedAt) {
		return errOlderScrape
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM products WHERE datetime=$1`, prepared.date); err != nil {
		return err
	}
	for _, item := range prepared.products {
		categories, err := json.Marshal(item.categories)
		if err != nil {
			return err
		}
		if _, err = tx.ExecContext(ctx, `INSERT INTO products (product_id,name,price,url,category,datetime) VALUES ($1,$2,$3,$4,$5,$6)`,
			item.ProductID, item.Name, item.price, item.URL, string(categories), prepared.date); err != nil {
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
	if _, err = tx.ExecContext(ctx, `DELETE FROM stats WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.product_id=stats.product_id)`); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, rebuildStatsSQL); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM scraper WHERE datetime=$1`, prepared.date); err != nil {
		return err
	}
	m := prepared.output.Metadata
	if _, err = tx.ExecContext(ctx, `INSERT INTO scraper (datetime,scraper_version,total_products,total_failed,categories_scraped,categories,observed_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		prepared.date, m.ScraperVersion, m.TotalProducts, m.TotalFailed, m.CategoriesScraped, strings.Join(m.Categories, ","), prepared.observedAt); err != nil {
		return err
	}
	for _, category := range m.Categories {
		if _, err = tx.ExecContext(ctx, `INSERT INTO categories (category) VALUES ($1) ON CONFLICT DO NOTHING`, category); err != nil {
			return err
		}
	}
	return tx.Commit()
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

func migrateObservations(database *sql.DB) error {
	tx, err := database.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.Exec(`SELECT pg_advisory_xact_lock(817423)`); err != nil {
		return err
	}
	var migrated bool
	if err = tx.QueryRow(`SELECT to_regclass('products_daily_unique') IS NOT NULL`).Scan(&migrated); err != nil {
		return err
	}
	if !migrated {
		// Legacy data has no ordering within a day. Preserve every removed row
		// before deterministically keeping the last physical row for that day.
		for _, query := range []string{
			`LOCK TABLE products IN ACCESS EXCLUSIVE MODE`,
			`CREATE TABLE IF NOT EXISTS products_duplicate_archive (LIKE products INCLUDING DEFAULTS)`,
			`WITH removed AS (DELETE FROM products a USING products b WHERE a.product_id=b.product_id AND a.datetime=b.datetime AND a.ctid < b.ctid RETURNING a.*) INSERT INTO products_duplicate_archive SELECT * FROM removed`,
			`CREATE UNIQUE INDEX products_daily_unique ON products (product_id, datetime)`,
			`CREATE INDEX IF NOT EXISTS products_recording_date ON products (datetime)`,
			rebuildStatsSQL,
		} {
			if _, err = tx.Exec(query); err != nil {
				return err
			}
		}
	}
	if _, err = tx.Exec(`ALTER TABLE scraper ADD COLUMN IF NOT EXISTS observed_at TIMESTAMPTZ`); err != nil {
		return err
	}
	return tx.Commit()
}
