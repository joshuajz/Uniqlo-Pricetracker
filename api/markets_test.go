package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestUnknownMarketRejectedBeforeDatabaseRead(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	registerReadRoutes(router)
	// Also ensure the protected upload route can coexist with regional GETs.
	router.POST("/api/products/injest", func(c *gin.Context) { c.Status(http.StatusUnauthorized) })
	for _, path := range []string{"/api/au/products", "/api/ca-jp/product/E1", "/api/zz/product/E1/image", "/api/xx/categories", "/api/xx/category/men/tops"} {
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
		if recorder.Code != http.StatusNotFound {
			t.Fatalf("%s: %d", path, recorder.Code)
		}
	}
}

func TestRegionalReadsIsolateHistoryStatsImagesAndCaches(t *testing.T) {
	database := testDatabase(t)
	previous := db
	db = database
	productsCache = &ProductsCache{}
	productDetailCache = &ProductDetailCache{cache: make(map[string]productCacheEntry)}
	t.Cleanup(func() {
		db = previous
		productsCache = &ProductsCache{}
		productDetailCache = &ProductDetailCache{cache: make(map[string]productCacheEntry)}
	})
	router := gin.New()
	registerReadRoutes(router)
	markets := []struct {
		slug, code, currency, price string
		number                      float64
	}{
		{"ca", "CA", "CAD", "CA $ 19.90", 19.9},
		{"us", "US", "USD", "$24.90", 24.9},
		{"uk", "GB", "GBP", "£14.90", 14.9},
		{"jp", "JP", "JPY", "¥1,990", 1990},
	}
	for i, market := range markets {
		for day := 1; day <= i+1; day++ {
			output := marketFixture(fmt.Sprintf("2026-09-%02dT03:00:00Z", day), market.code, market.currency, market.price)
			item := output.Products["men/tops"][0]
			output.Products = map[string][]Product{market.slug + "/tops": {item}}
			output.Metadata.Categories = []string{market.slug + "/tops"}
			prepared, err := prepareIngest(output, nil)
			if err != nil {
				t.Fatal(err)
			}
			if err := persistIngest(context.Background(), database, prepared); err != nil {
				t.Fatal(err)
			}
		}
		// Distinct byte payloads verify the image lookup includes the market.
		hash := sha256.Sum256([]byte(market.code))
		var imageID int64
		if err := database.QueryRow(`INSERT INTO images(content_sha256,image,byte_size) VALUES($1,$2,$3) RETURNING image_id`, hash[:], []byte(market.code), len(market.code)).Scan(&imageID); err != nil {
			t.Fatal(err)
		}
		if _, err := database.Exec(`INSERT INTO product_images(market_code,product_id,image_id,last_updated) VALUES($1,'E1',$2,'2026-09-01')`, market.code, imageID); err != nil {
			t.Fatal(err)
		}
	}
	// Repeat reads to exercise cache hits with deliberately colliding product IDs.
	for pass := 0; pass < 2; pass++ {
		for i, market := range markets {
			for _, suffix := range []string{"/products", "/category/" + market.slug + "/tops", "/product/E1", "/categories", "/product/E1/image"} {
				path := "/api/" + market.slug + suffix
				recorder := httptest.NewRecorder()
				router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
				if recorder.Code != http.StatusOK {
					t.Fatalf("%s: %d %s", path, recorder.Code, recorder.Body.String())
				}
				if suffix == "/product/E1/image" {
					if !bytes.Equal(recorder.Body.Bytes(), []byte(market.code)) {
						t.Fatalf("%s: wrong image", path)
					}
					continue
				}
				var response struct {
					Market       string             `json:"market"`
					Currency     string             `json:"currency"`
					Datetime     string             `json:"datetime"`
					Products     []ProductResponse  `json:"products"`
					CurrentPrice float64            `json:"current_price"`
					RegularPrice float64            `json:"regular_price"`
					Datapoints   []ProductDatapoint `json:"datapoints"`
					Categories   []string           `json:"categories"`
				}
				if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
					t.Fatal(err)
				}
				if response.Market != market.code || response.Currency != market.currency {
					t.Fatalf("%s: wrong market/currency %+v", path, response)
				}
				switch suffix {
				case "/products", "/category/" + market.slug + "/tops":
					if len(response.Products) != 1 || response.Products[0].Price != market.number || response.Products[0].LowestPrice != market.number || response.Datetime != fmt.Sprintf("2026-09-%02dT00:00:00Z", i+1) {
						t.Fatalf("%s: leaked snapshot %+v", path, response)
					}
				case "/product/E1":
					if response.CurrentPrice != market.number || response.RegularPrice != market.number || len(response.Datapoints) != i+1 {
						t.Fatalf("%s: leaked history %+v", path, response)
					}
				case "/categories":
					if len(response.Categories) != 1 || response.Categories[0] != market.slug+"/tops" {
						t.Fatalf("%s: leaked categories %+v", path, response)
					}
				}
			}
		}
	}
	for _, path := range []string{"/api/gb/product/E1", "/api/UK/product/E1"} {
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
		if recorder.Code != http.StatusOK || !bytes.Contains(recorder.Body.Bytes(), []byte(`"currency":"GBP"`)) {
			t.Fatalf("alias %s failed: %s", path, recorder.Body.String())
		}
	}
}

func TestEmptyRegionalCatalogueIsAnArrayAndNeverFallsBackToCanada(t *testing.T) {
	database := testDatabase(t)
	ingestFixture(t, database, "2026-09-01T03:00:00Z", "CA $ 19.90")
	previous := db
	db = database
	productsCache = &ProductsCache{}
	productDetailCache = &ProductDetailCache{cache: make(map[string]productCacheEntry)}
	t.Cleanup(func() { db = previous })
	router := gin.New()
	registerReadRoutes(router)
	for _, path := range []string{"/api/jp/products", "/api/jp/category/men/tops"} {
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
		var body map[string]any
		if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		if recorder.Code != 200 || body["market"] != "JP" || body["count"] != float64(0) || body["datetime"] != nil {
			t.Fatalf("empty market: %s", recorder.Body.String())
		}
		if products, ok := body["products"].([]any); !ok || len(products) != 0 {
			t.Fatalf("expected empty array: %s", recorder.Body.String())
		}
	}
	for _, path := range []string{"/api/jp/product/E1", "/api/jp/product/E1/image"} {
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
		if recorder.Code != 404 {
			t.Fatalf("absent regional product fell back: %s %d", path, recorder.Code)
		}
	}
}
