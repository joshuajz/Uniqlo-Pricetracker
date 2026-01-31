package main

import (
	"database/sql"
	"fmt"
	_ "modernc.org/sqlite"
)

func main() {
	db, err := sql.Open("sqlite", "products.db")
	if err != nil {
		panic(err)
	}
	defer db.Close()

	queries := []string{
		`CREATE TABLE IF NOT EXISTS "images" ("product_id" TEXT NOT NULL UNIQUE, "image" BLOB NOT NULL, "last_updated" TEXT)`,
		`CREATE TABLE IF NOT EXISTS "products" ("product_id" TEXT NOT NULL, "name" TEXT NOT NULL, "price" REAL NOT NULL, "url" TEXT NOT NULL, "category" TEXT NOT NULL, "datetime" TEXT NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS "scraper" ("datetime" TEXT NOT NULL, "scraper_version" TEXT NOT NULL, "total_products" INTEGER NOT NULL, "total_failed" INTEGER NOT NULL, "categories_scraped" INTEGER NOT NULL, "categories" TEXT NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS "stats" ("product_id" TEXT NOT NULL, "lowest_price" REAL NOT NULL, "lowest_price_datetime" TEXT NOT NULL, "highest_price" REAL NOT NULL, "highest_price_datetime" TEXT NOT NULL, "regular_price" REAL NOT NULL)`,
	}

	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			panic(err)
		}
	}
	fmt.Println("All tables created successfully.")
}
