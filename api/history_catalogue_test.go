package main

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestHistoricalCatalogueAndDetailMembership(t *testing.T) {
	database := testDatabase(t)
	previous := db
	db = database
	invalidateProductCaches()
	t.Cleanup(func() { db = previous; invalidateProductCaches() })
	// The same ID in another market must not affect Canada membership or prices.
	_, err := database.Exec(`INSERT INTO products(market_code,product_id,name,price,currency_code,url,category,datetime) VALUES
 ('CA','OLD','Old shirt',20,'CAD','https://www.uniqlo.com/ca/en/','["men/tops"]','2026-10-01'),
 ('CA','OLD','Archived shirt',10,'CAD','https://www.uniqlo.com/ca/en/','["men/tops"]','2026-10-02'),
 ('CA','NEW','Current shirt',30,'CAD','https://www.uniqlo.com/ca/en/','["men/tops"]','2026-10-15'),
 ('US','OLD','US shirt',99,'USD','https://www.uniqlo.com/us/en/','["men/tops"]','2026-10-16')`)
	if err != nil {
		t.Fatal(err)
	}
	router := gin.New()
	registerReadRoutes(router)
	for pass := 0; pass < 2; pass++ {
		for _, scope := range []struct {
			query string
			count int
		}{{"", 1}, {"?include_archived=1", 2}} {
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, httptest.NewRequest("GET", "/api/ca/products"+scope.query, nil))
			var body struct {
				Products []ProductResponse `json:"products"`
			}
			if recorder.Code != 200 {
				t.Fatal(recorder.Body.String())
			}
			if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if len(body.Products) != scope.count {
				t.Fatalf("scope %s: %s", scope.query, recorder.Body.String())
			}
			for _, p := range body.Products {
				if p.ProductID == "OLD" && (!p.IsArchived || p.Price != 10 || p.Name != "Archived shirt") {
					t.Fatalf("wrong archived observation: %+v", p)
				}
				if p.ProductID == "NEW" && p.IsArchived {
					t.Fatal("current product marked archived")
				}
			}
		}
		for _, id := range []string{"OLD", "NEW"} {
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, httptest.NewRequest("GET", "/api/ca/product/"+id, nil))
			var body struct {
				Archived bool `json:"is_archived"`
			}
			if recorder.Code != 200 {
				t.Fatal(recorder.Body.String())
			}
			if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if body.Archived != (id == "OLD") {
				t.Fatalf("wrong membership: %s", recorder.Body.String())
			}
		}
	}
	// A returning product must lose its archived state after cache invalidation.
	_, err = database.Exec(`INSERT INTO products SELECT market_code, product_id, name, price, currency_code, url, category, '2026-10-15'::date FROM products WHERE market_code='CA' AND product_id='OLD' AND datetime='2026-10-02'`)
	if err != nil {
		t.Fatal(err)
	}
	invalidateProductCaches()
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest("GET", "/api/ca/product/OLD", nil))
	var body struct {
		Archived bool `json:"is_archived"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if recorder.Code != 200 || body.Archived {
		t.Fatalf("returning product remains archived: %s", recorder.Body.String())
	}
}
