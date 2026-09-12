package main

import (
	"api/internal/productimage"
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func imageArchive(t *testing.T, data []byte) map[string]*zip.File {
	t.Helper()
	var buffer bytes.Buffer
	w := zip.NewWriter(&buffer)
	f, err := w.Create("images/E1.jpg")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = f.Write(data); err != nil {
		t.Fatal(err)
	}
	if err = w.Close(); err != nil {
		t.Fatal(err)
	}
	r, err := zip.NewReader(bytes.NewReader(buffer.Bytes()), int64(buffer.Len()))
	if err != nil {
		t.Fatal(err)
	}
	return map[string]*zip.File{"images/E1.jpg": r.File[0]}
}

func fixtureWithImage() ScraperOutput {
	output := fixture("2026-09-12T03:00:00Z", "CA $ 19.90")
	output.Products["men/tops"][0].Image = "images/E1.jpg"
	return output
}

func TestPrepareIngestCompressesImageAndRejectsInvalidData(t *testing.T) {
	var original bytes.Buffer
	im := image.NewRGBA(image.Rect(0, 0, 80, 120))
	for y := 0; y < 120; y++ {
		for x := 0; x < 80; x++ {
			im.SetRGBA(x, y, color.RGBA{uint8(x * y), uint8(x), uint8(y), 255})
		}
	}
	if err := jpeg.Encode(&original, im, &jpeg.Options{Quality: 98}); err != nil {
		t.Fatal(err)
	}
	want, err := productimage.Compress(original.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	prepared, err := prepareIngest(fixtureWithImage(), imageArchive(t, original.Bytes()))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(prepared.products[0].image, want) || len(want) >= original.Len() {
		t.Fatal("archive preparation did not compress the image")
	}
	if prepared.products[0].imageHash != sha256.Sum256(want) {
		t.Fatal("archive preparation did not hash the stored image bytes")
	}
	for _, data := range [][]byte{[]byte("invalid image"), make([]byte, productimage.MaxInputBytes+1)} {
		if _, err := prepareIngest(fixtureWithImage(), imageArchive(t, data)); err == nil {
			t.Fatal("accepted invalid or oversized image from archive")
		}
	}
}

func TestCompressedImageIsStoredAndSurvivesPriceOnlyIngest(t *testing.T) {
	database := testDatabase(t)
	var original bytes.Buffer
	if err := png.Encode(&original, image.NewNRGBA(image.Rect(0, 0, 80, 120))); err != nil {
		t.Fatal(err)
	}
	prepared, err := prepareIngest(fixtureWithImage(), imageArchive(t, original.Bytes()))
	if err != nil {
		t.Fatal(err)
	}
	if err = persistIngest(context.Background(), database, prepared); err != nil {
		t.Fatal(err)
	}
	ingestFixture(t, database, "2026-09-13T03:00:00Z", "CA $ 9.90")
	var stored []byte
	var updated string
	if err = database.QueryRow(`SELECT i.image,pi.last_updated::text
		FROM product_images pi JOIN images i ON i.image_id=pi.image_id
		WHERE pi.market_code='CA' AND pi.product_id='E1'`).Scan(&stored, &updated); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(stored, prepared.products[0].image) || updated != "2026-09-12" {
		t.Fatal("price-only ingest changed the stored photo")
	}
	if _, err = jpeg.Decode(bytes.NewReader(stored)); err != nil {
		t.Fatalf("stored photo is not a JPEG: %v", err)
	}

	previousDB := db
	db = database
	defer func() { db = previousDB }()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/product/:id/image", getProductImage)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/product/E1/image", nil))
	if recorder.Code != http.StatusOK || !bytes.Equal(recorder.Body.Bytes(), stored) {
		t.Fatalf("image endpoint returned status %d with %d bytes", recorder.Code, recorder.Body.Len())
	}
}

func TestIdenticalImagesShareOneBlob(t *testing.T) {
	database := testDatabase(t)
	var original bytes.Buffer
	if err := png.Encode(&original, image.NewNRGBA(image.Rect(0, 0, 80, 120))); err != nil {
		t.Fatal(err)
	}
	output := fixtureWithImage()
	second := output.Products["men/tops"][0]
	second.ProductID = "E2"
	second.Name = "Second shirt"
	second.URL = "https://www.uniqlo.com/ca/en/products/E2/00"
	output.Products["men/tops"] = append(output.Products["men/tops"], second)
	output.Metadata.TotalProducts = 2
	prepared, err := prepareIngest(output, imageArchive(t, original.Bytes()))
	if err != nil {
		t.Fatal(err)
	}
	if err = persistIngest(context.Background(), database, prepared); err != nil {
		t.Fatal(err)
	}

	var blobs, mappings, distinctImageIDs int
	if err = database.QueryRow(`SELECT COUNT(*) FROM images`).Scan(&blobs); err != nil {
		t.Fatal(err)
	}
	if err = database.QueryRow(`SELECT COUNT(*),COUNT(DISTINCT image_id) FROM product_images`).Scan(&mappings, &distinctImageIDs); err != nil {
		t.Fatal(err)
	}
	if blobs != 1 || mappings != 2 || distinctImageIDs != 1 {
		t.Fatalf("deduplication: blobs=%d mappings=%d distinct image IDs=%d", blobs, mappings, distinctImageIDs)
	}
}

func TestImageReplacementReclaimsOrphanAndRejectsOlderBackfill(t *testing.T) {
	database := testDatabase(t)
	imageBytes := func(marker byte) []byte {
		im := image.NewNRGBA(image.Rect(0, 0, 80, 120))
		im.SetNRGBA(0, 0, color.NRGBA{R: marker, G: 50, B: 100, A: 255})
		var output bytes.Buffer
		if err := png.Encode(&output, im); err != nil {
			t.Fatal(err)
		}
		return output.Bytes()
	}
	ingestImage := func(date string, data []byte) preparedIngest {
		output := fixtureWithImage()
		output.Metadata.Datetime = date
		prepared, err := prepareIngest(output, imageArchive(t, data))
		if err != nil {
			t.Fatal(err)
		}
		if err = persistIngest(context.Background(), database, prepared); err != nil {
			t.Fatal(err)
		}
		return prepared
	}

	ingestImage("2026-09-13T03:00:00Z", imageBytes(10))
	newest := ingestImage("2026-09-14T03:00:00Z", imageBytes(20))
	ingestImage("2026-09-12T03:00:00Z", imageBytes(30))

	var blobs int
	var stored []byte
	var updated string
	if err := database.QueryRow(`SELECT COUNT(*) FROM images`).Scan(&blobs); err != nil {
		t.Fatal(err)
	}
	if err := database.QueryRow(`SELECT i.image,pi.last_updated::text
		FROM product_images pi JOIN images i ON i.image_id=pi.image_id
		WHERE pi.market_code='CA' AND pi.product_id='E1'`).Scan(&stored, &updated); err != nil {
		t.Fatal(err)
	}
	if blobs != 1 || updated != "2026-09-14" || !bytes.Equal(stored, newest.products[0].image) {
		t.Fatalf("image lifecycle: blobs=%d updated=%s newest retained=%t", blobs, updated, bytes.Equal(stored, newest.products[0].image))
	}
}

func TestLegacyImagesAreDiscardedOnce(t *testing.T) {
	database := testDatabase(t)
	if _, err := database.Exec(`DROP TABLE product_images; DROP TABLE images;
		CREATE TABLE images (product_id TEXT NOT NULL UNIQUE,image BYTEA NOT NULL,last_updated DATE DEFAULT NOW());
		INSERT INTO images (product_id,image) VALUES ('legacy','old')`); err != nil {
		t.Fatal(err)
	}
	if err := initializeImageSchema(database); err != nil {
		t.Fatal(err)
	}
	if err := initializeImageSchema(database); err != nil {
		t.Fatalf("image migration is not idempotent: %v", err)
	}
	var blobs, mappings int
	if err := database.QueryRow(`SELECT COUNT(*) FROM images`).Scan(&blobs); err != nil {
		t.Fatal(err)
	}
	if err := database.QueryRow(`SELECT COUNT(*) FROM product_images`).Scan(&mappings); err != nil {
		t.Fatal(err)
	}
	if blobs != 0 || mappings != 0 {
		t.Fatalf("legacy images survived reset: blobs=%d mappings=%d", blobs, mappings)
	}
}

func fixture(date, price string) ScraperOutput {
	var output ScraperOutput
	output.Metadata.Datetime = date
	output.Metadata.ScraperVersion = "test"
	output.Metadata.Market = currentMarketCode
	output.Metadata.Currency = currentCurrencyCode
	output.Metadata.TotalProducts = 1
	output.Metadata.CategoriesScraped = 1
	output.Metadata.Categories = []string{"men/tops"}
	output.Products = map[string][]Product{"men/tops": {{ProductID: "E1", Name: "Shirt", URL: "https://www.uniqlo.com/ca/en/products/E1/00", Price: price}}}
	return output
}

func TestArchiveValidation(t *testing.T) {
	for _, price := range []string{"19.90", "", "CA $ NaN", "CA $ -1", "CA $ 1.234", "CA $ 999999999"} {
		if _, err := prepareIngest(fixture("2026-09-10T12:00:00Z", price), nil); err == nil {
			t.Errorf("accepted invalid price %q", price)
		}
	}
	if _, err := prepareIngest(fixture("invalid", "CA $ 19.90"), nil); err == nil {
		t.Fatal("accepted invalid date")
	}
	p, err := prepareIngest(fixture("2026-09-10T23:30:00-04:00", "CA $ 19.90"), nil)
	if err != nil || p.date != "2026-09-11" {
		t.Fatalf("UTC recording date: %+v, %v", p, err)
	}
	bad := fixture("2026-09-10T12:00:00Z", "CA $ 19.90")
	bad.Metadata.TotalProducts++
	if _, err := prepareIngest(bad, nil); err == nil {
		t.Fatal("accepted incomplete archive")
	}
	unsupported := fixture("2026-09-10T12:00:00Z", "CA $ 19.90")
	unsupported.Metadata.Market = "US"
	unsupported.Metadata.Currency = "USD"
	if _, err := prepareIngest(unsupported, nil); err == nil {
		t.Fatal("accepted a non-Canadian archive")
	}
}

// TEST_DATABASE_URL must point at a disposable Postgres instance. Each test uses
// a distinct schema; neither the application's DATABASE_URL nor its data is used.
func testDatabase(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL to run Postgres integration tests")
	}
	admin, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	schema := fmt.Sprintf("review_%d", time.Now().UnixNano())
	if _, err = admin.Exec("CREATE SCHEMA " + schema); err != nil {
		t.Fatal(err)
	}
	u, err := url.Parse(dsn)
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	q.Set("search_path", schema)
	u.RawQuery = q.Encode()
	database, err := sql.Open("postgres", u.String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { database.Close(); admin.Exec("DROP SCHEMA " + schema + " CASCADE"); admin.Close() })
	if err = initializeSchema(database); err != nil {
		t.Fatal(err)
	}
	return database
}

func ingestFixture(t *testing.T, database *sql.DB, date, price string) {
	t.Helper()
	p, err := prepareIngest(fixture(date, price), nil)
	if err == nil {
		err = persistIngest(context.Background(), database, p)
	}
	if err != nil {
		t.Fatal(err)
	}
}

func TestDailyReplacementAndBackfill(t *testing.T) {
	database := testDatabase(t)
	ingestFixture(t, database, "2026-09-10T12:00:00Z", "CA $ 19.90")
	ingestFixture(t, database, "2026-09-11T12:00:00Z", "CA $ 9.90")
	ingestFixture(t, database, "2026-09-11T13:00:00Z", "CA $ 29.90")
	ingestFixture(t, database, "2026-09-11T13:00:00Z", "CA $ 29.90")
	var count int
	database.QueryRow(`SELECT COUNT(*) FROM products`).Scan(&count)
	if count != 2 {
		t.Fatalf("retry created observations: %d", count)
	}
	var low, high, regular float64
	if err := database.QueryRow(`SELECT lowest_price,highest_price,regular_price FROM stats WHERE product_id='E1'`).Scan(&low, &high, &regular); err != nil {
		t.Fatal(err)
	}
	if low != 19.9 || high != 29.9 || regular != 29.9 {
		t.Fatalf("stale stats after correction: %v %v %v", low, high, regular)
	}
	older, _ := prepareIngest(fixture("2026-09-11T11:00:00Z", "CA $ 1.00"), nil)
	if err := persistIngest(context.Background(), database, older); !errors.Is(err, errOlderScrape) {
		t.Fatalf("older upload: %v", err)
	}
	ingestFixture(t, database, "2026-09-01T12:00:00Z", "CA $ 5.00")
	var date string
	database.QueryRow(`SELECT lowest_price_datetime::text FROM stats WHERE product_id='E1'`).Scan(&date)
	if date != "2026-09-01" {
		t.Fatalf("backfill assigned upload date: %s", date)
	}
}

func TestFailuresRollBackEntireSnapshot(t *testing.T) {
	for _, table := range []string{"products", "stats", "scraper", "categories", "images", "product_images"} {
		t.Run(table, func(t *testing.T) {
			database := testDatabase(t)
			ingestFixture(t, database, "2026-09-10T12:00:00Z", "CA $ 19.90")
			// Force a genuine database failure at each stage, including after the
			// product replacement and stats update have already executed.
			_, err := database.Exec(`CREATE FUNCTION reject_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected test failure'; END $$`)
			if err != nil {
				t.Fatal(err)
			}
			if _, err = database.Exec(`CREATE TRIGGER reject_write BEFORE INSERT ON ` + table + ` FOR EACH ROW EXECUTE FUNCTION reject_write()`); err != nil {
				t.Fatal(err)
			}
			p, _ := prepareIngest(fixture("2026-09-10T13:00:00Z", "CA $ 9.90"), nil)
			p.products[0].image = []byte("test-image")
			p.products[0].imageHash = sha256.Sum256(p.products[0].image)
			if err = persistIngest(context.Background(), database, p); err == nil {
				t.Fatal("failure was swallowed")
			}
			var price, low float64
			if err = database.QueryRow(`SELECT price FROM products WHERE product_id='E1'`).Scan(&price); err != nil {
				t.Fatal(err)
			}
			if err = database.QueryRow(`SELECT lowest_price FROM stats WHERE product_id='E1'`).Scan(&low); err != nil {
				t.Fatal(err)
			}
			if price != 19.9 || low != 19.9 {
				t.Fatalf("partial commit: price=%v low=%v", price, low)
			}
		})
	}
}

func TestConcurrentSnapshotsKeepNewest(t *testing.T) {
	database := testDatabase(t)
	var wg sync.WaitGroup
	for hour := 10; hour < 15; hour++ {
		wg.Add(1)
		go func(hour int) {
			defer wg.Done()
			p, _ := prepareIngest(fixture(fmt.Sprintf("2026-09-11T%d:00:00Z", hour), fmt.Sprintf("CA $ %d.00", hour)), nil)
			if err := persistIngest(context.Background(), database, p); err != nil && !errors.Is(err, errOlderScrape) {
				t.Error(err)
			}
		}(hour)
	}
	wg.Wait()
	var count int
	var price float64
	if err := database.QueryRow(`SELECT COUNT(*),MAX(price) FROM products`).Scan(&count, &price); err != nil {
		t.Fatal(err)
	}
	if count != 1 || price != 14 {
		t.Fatalf("concurrent snapshots: count=%d price=%v", count, price)
	}
}

func TestMigrationPreservesDuplicatesAndEnforcesUniqueDays(t *testing.T) {
	database := testDatabase(t)
	ingestFixture(t, database, "2026-09-11T12:00:00Z", "CA $ 19.90")
	if _, err := database.Exec(`DROP INDEX products_daily_unique; INSERT INTO products SELECT product_id,name,9.90,url,category,datetime FROM products`); err != nil {
		t.Fatal(err)
	}
	if err := migrateObservations(database); err != nil {
		t.Fatal(err)
	}
	if err := migrateObservations(database); err != nil {
		t.Fatal(err)
	}
	var active, archived int
	database.QueryRow(`SELECT COUNT(*) FROM products`).Scan(&active)
	database.QueryRow(`SELECT COUNT(*) FROM products_duplicate_archive`).Scan(&archived)
	if active != 1 || archived != 1 {
		t.Fatalf("migration: active=%d archived=%d", active, archived)
	}
	var low float64
	if err := database.QueryRow(`SELECT lowest_price FROM stats WHERE product_id='E1'`).Scan(&low); err != nil {
		t.Fatal(err)
	}
	if low != 9.9 {
		t.Fatalf("migration did not rebuild stats: %v", low)
	}
	if _, err := database.Exec(`INSERT INTO products SELECT * FROM products`); err == nil {
		t.Fatal("duplicate allowed")
	}
}
