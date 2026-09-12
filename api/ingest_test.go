package main

import (
	"api/internal/productimage"
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
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
	return marketFixture(date, currentMarketCode, currentCurrencyCode, price)
}

func marketFixture(date, market, currency, price string) ScraperOutput {
	var output ScraperOutput
	output.Metadata.Datetime = date
	output.Metadata.ScraperVersion = "test"
	output.Metadata.Market = market
	output.Metadata.Currency = currency
	output.Metadata.TotalProducts = 1
	output.Metadata.CategoriesScraped = 1
	output.Metadata.Categories = []string{"men/tops"}
	output.Products = map[string][]Product{"men/tops": {{ProductID: "E1", Name: "Shirt", URL: "https://www.uniqlo.com/products/E1", Price: price}}}
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
	unsupported.Metadata.Market = "AU"
	unsupported.Metadata.Currency = "AUD"
	if _, err := prepareIngest(unsupported, nil); err == nil {
		t.Fatal("accepted an unsupported market")
	}
	wrongCurrency := fixture("2026-09-10T12:00:00Z", "CA $ 19.90")
	wrongCurrency.Metadata.Currency = "USD"
	if _, err := prepareIngest(wrongCurrency, nil); err == nil {
		t.Fatal("accepted a market/currency mismatch")
	}

	for _, tc := range []struct {
		market, currency, price, normalized string
	}{
		{"CA", "CAD", "CA $ 1,299.90", "1299.90"},
		{"US", "USD", "$24.90", "24.90"},
		{"GB", "GBP", "£19.90", "19.90"},
		{"JP", "JPY", "¥1,990", "1990"},
	} {
		prepared, err := prepareIngest(marketFixture("2026-09-10T12:00:00Z", tc.market, tc.currency, tc.price), nil)
		if err != nil {
			t.Fatalf("rejected %s archive: %v", tc.market, err)
		}
		if prepared.products[0].price != tc.normalized {
			t.Fatalf("%s price normalized to %q", tc.market, prepared.products[0].price)
		}
	}
}

func TestMarketsRouteToPartitionsAndCanadaAPIStaysScoped(t *testing.T) {
	database := testDatabase(t)
	for _, tc := range []struct {
		market, currency, price string
	}{
		{"CA", "CAD", "CA $ 19.90"},
		{"US", "USD", "$24.90"},
		{"GB", "GBP", "£14.90"},
		{"JP", "JPY", "¥1,990"},
	} {
		prepared, err := prepareIngest(marketFixture("2026-09-15T03:00:00Z", tc.market, tc.currency, tc.price), nil)
		if err != nil {
			t.Fatal(err)
		}
		if err = persistIngest(context.Background(), database, prepared); err != nil {
			t.Fatalf("persist %s: %v", tc.market, err)
		}
	}

	for _, table := range []string{"products_ca", "products_us", "products_gb", "products_jp"} {
		var count int
		if err := database.QueryRow(`SELECT COUNT(*) FROM ` + table).Scan(&count); err != nil {
			t.Fatal(err)
		}
		if count != 1 {
			t.Fatalf("%s has %d rows", table, count)
		}
	}
	var products, stats, runs, categories int
	if err := database.QueryRow(`SELECT COUNT(*) FROM products`).Scan(&products); err != nil {
		t.Fatal(err)
	}
	if err := database.QueryRow(`SELECT COUNT(*) FROM stats`).Scan(&stats); err != nil {
		t.Fatal(err)
	}
	if err := database.QueryRow(`SELECT COUNT(*) FROM scraper`).Scan(&runs); err != nil {
		t.Fatal(err)
	}
	if err := database.QueryRow(`SELECT COUNT(*) FROM categories`).Scan(&categories); err != nil {
		t.Fatal(err)
	}
	if products != 4 || stats != 4 || runs != 4 || categories != 4 {
		t.Fatalf("market isolation: products=%d stats=%d runs=%d categories=%d", products, stats, runs, categories)
	}

	previousDB := db
	db = database
	defer func() { db = previousDB }()
	productsCache = &ProductsCache{}
	productDetailCache = &ProductDetailCache{cache: make(map[string]productCacheEntry)}
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/products", getProducts)
	router.GET("/api/category/*category", getProductsByCategory)
	router.GET("/api/product/:id", getProduct)
	router.GET("/api/categories", getCategories)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/products", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("Canada API returned %d: %s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Products []ProductResponse `json:"products"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if len(response.Products) != 1 || response.Products[0].Price != 19.9 {
		t.Fatalf("Canada API leaked another market: %+v", response.Products)
	}

	recorder = httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/category/men/tops", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("Canada category API returned %d: %s", recorder.Code, recorder.Body.String())
	}
	response.Products = nil
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if len(response.Products) != 1 || response.Products[0].Price != 19.9 {
		t.Fatalf("Canada category API leaked another market: %+v", response.Products)
	}

	recorder = httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/product/E1", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("Canada detail API returned %d: %s", recorder.Code, recorder.Body.String())
	}
	var detail struct {
		CurrentPrice float64            `json:"current_price"`
		Datapoints   []ProductDatapoint `json:"datapoints"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &detail); err != nil {
		t.Fatal(err)
	}
	if detail.CurrentPrice != 19.9 || len(detail.Datapoints) != 1 {
		t.Fatalf("Canada detail API leaked another market: %+v", detail)
	}

	recorder = httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/categories", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("Canada categories API returned %d: %s", recorder.Code, recorder.Body.String())
	}
	var categoryResponse struct {
		Categories []string `json:"categories"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &categoryResponse); err != nil {
		t.Fatal(err)
	}
	if len(categoryResponse.Categories) != 1 || categoryResponse.Categories[0] != "men/tops" {
		t.Fatalf("Canada categories API leaked another market: %+v", categoryResponse.Categories)
	}
}

// TEST_DATABASE_URL must point at a disposable Postgres instance. Each test uses
// a distinct schema; neither the application's DATABASE_URL nor its data is used.
func testDatabase(t *testing.T) *sql.DB {
	t.Helper()
	database := uninitializedTestDatabase(t)
	if err := initializeSchema(database); err != nil {
		t.Fatal(err)
	}
	return database
}

func uninitializedTestDatabase(t *testing.T) *sql.DB {
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

func TestLegacyCanadaMigrationCreatesPartitionsAndPreservesRollbackTables(t *testing.T) {
	database := uninitializedTestDatabase(t)
	if _, err := database.Exec(`
		CREATE TABLE products (
			product_id TEXT NOT NULL,name TEXT NOT NULL,price NUMERIC(10,2) NOT NULL,
			url TEXT NOT NULL,category JSONB NOT NULL,datetime DATE NOT NULL
		);
		INSERT INTO products VALUES
			('E1','Shirt',19.90,'https://example.test/E1','["men/tops"]','2026-09-11'),
			('E1','Shirt',9.90,'https://example.test/E1','["men/tops"]','2026-09-11');
		CREATE TABLE stats (
			product_id TEXT NOT NULL UNIQUE,lowest_price NUMERIC(10,2) NOT NULL,
			lowest_price_datetime DATE NOT NULL,highest_price NUMERIC(10,2) NOT NULL,
			highest_price_datetime DATE NOT NULL,regular_price NUMERIC(10,2) NOT NULL
		);
		INSERT INTO stats VALUES ('E1',19.90,'2026-09-11',19.90,'2026-09-11',19.90);
		CREATE TABLE scraper (
			datetime DATE NOT NULL,scraper_version TEXT NOT NULL,total_products INTEGER NOT NULL,
			total_failed INTEGER NOT NULL,categories_scraped INTEGER NOT NULL,categories TEXT NOT NULL,
			observed_at TIMESTAMPTZ
		);
		INSERT INTO scraper VALUES
			('2026-09-11','older',1,0,1,'men/tops',NULL),
			('2026-09-11','newer',1,0,1,'men/tops','2026-09-11T04:00:00Z');
		CREATE TABLE categories (category TEXT NOT NULL UNIQUE);
		INSERT INTO categories VALUES ('men/tops');
	`); err != nil {
		t.Fatal(err)
	}

	if err := initializeSchema(database); err != nil {
		t.Fatal(err)
	}
	if err := initializeSchema(database); err != nil {
		t.Fatalf("market migration is not idempotent: %v", err)
	}

	var partitioned bool
	if err := database.QueryRow(`SELECT EXISTS (
		SELECT 1 FROM pg_partitioned_table WHERE partrelid='products'::regclass
	)`).Scan(&partitioned); err != nil {
		t.Fatal(err)
	}
	if !partitioned {
		t.Fatal("products was not converted to a partitioned table")
	}
	for _, table := range []string{"products_ca", "products_us", "products_gb", "products_jp"} {
		var exists bool
		if err := database.QueryRow(`SELECT to_regclass($1) IS NOT NULL`, table).Scan(&exists); err != nil {
			t.Fatal(err)
		}
		if !exists {
			t.Fatalf("partition %s was not created", table)
		}
	}

	var active, canadian, archived, legacy int
	if err := database.QueryRow(`SELECT COUNT(*) FROM products`).Scan(&active); err != nil {
		t.Fatal(err)
	}
	if err := database.QueryRow(`SELECT COUNT(*) FROM products_ca`).Scan(&canadian); err != nil {
		t.Fatal(err)
	}
	if err := database.QueryRow(`SELECT COUNT(*) FROM products_duplicate_archive`).Scan(&archived); err != nil {
		t.Fatal(err)
	}
	if err := database.QueryRow(`SELECT COUNT(*) FROM products_legacy_ca`).Scan(&legacy); err != nil {
		t.Fatal(err)
	}
	if active != 1 || canadian != 1 || archived != 1 || legacy != 1 {
		t.Fatalf("migration counts: active=%d CA=%d duplicate archive=%d legacy=%d", active, canadian, archived, legacy)
	}

	var market, currency, scraperVersion string
	var low float64
	var observedAt time.Time
	if err := database.QueryRow(`SELECT market_code,currency_code,price FROM products`).Scan(&market, &currency, &low); err != nil {
		t.Fatal(err)
	}
	if market != "CA" || currency != "CAD" || low != 9.9 {
		t.Fatalf("Canadian product migration: market=%s currency=%s price=%v", market, currency, low)
	}
	if err := database.QueryRow(`SELECT market_code,lowest_price FROM stats WHERE product_id='E1'`).Scan(&market, &low); err != nil {
		t.Fatal(err)
	}
	if market != "CA" || low != 9.9 {
		t.Fatalf("stats migration: market=%s low=%v", market, low)
	}
	if err := database.QueryRow(`SELECT market_code,currency_code,scraper_version,observed_at FROM scraper`).Scan(&market, &currency, &scraperVersion, &observedAt); err != nil {
		t.Fatal(err)
	}
	if market != "CA" || currency != "CAD" || scraperVersion != "newer" || observedAt.IsZero() {
		t.Fatalf("scraper migration: market=%s currency=%s version=%s observed=%s", market, currency, scraperVersion, observedAt)
	}

	if _, err := database.Exec(`INSERT INTO products (market_code,product_id,name,price,currency_code,url,category,datetime)
		VALUES ('US','E1','US Shirt',24.90,'USD','https://example.test/us/E1','["men/tops"]','2026-09-11')`); err != nil {
		t.Fatal(err)
	}
	if err := database.QueryRow(`SELECT COUNT(*) FROM products_us`).Scan(&active); err != nil {
		t.Fatal(err)
	}
	if active != 1 {
		t.Fatalf("US row was not routed to products_us: %d", active)
	}
	if _, err := database.Exec(`INSERT INTO products (market_code,product_id,name,price,currency_code,url,category,datetime)
		VALUES ('CA','E1','Duplicate',1.00,'CAD','https://example.test/E1','[]','2026-09-11')`); err == nil {
		t.Fatal("same-market daily duplicate was allowed")
	}
	if _, err := database.Exec(`INSERT INTO products (market_code,product_id,name,price,currency_code,url,category,datetime)
		VALUES ('GB','E2','Wrong Currency',1.00,'USD','https://example.test/E2','[]','2026-09-11')`); err == nil {
		t.Fatal("market/currency mismatch was allowed")
	}
}
