package main

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/lib/pq"
)

func main() {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		panic("DATABASE_URL environment variable must be set")
	}

	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		panic(err)
	}
	defer db.Close()

	if err = db.Ping(); err != nil {
		panic(fmt.Sprintf("Failed to connect to database: %v", err))
	}

	queries := []string{
		`CREATE TABLE IF NOT EXISTS products (
			product_id TEXT NOT NULL,
			name TEXT NOT NULL,
			price NUMERIC(10,2) NOT NULL,
			url TEXT NOT NULL,
			category JSONB NOT NULL,
			datetime TIMESTAMPTZ NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS scraper (
			datetime TIMESTAMPTZ NOT NULL,
			scraper_version TEXT NOT NULL,
			total_products INTEGER NOT NULL,
			total_failed INTEGER NOT NULL,
			categories_scraped INTEGER NOT NULL,
			categories TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS stats (
			product_id TEXT NOT NULL UNIQUE,
			lowest_price NUMERIC(10,2) NOT NULL,
			lowest_price_datetime TIMESTAMPTZ NOT NULL,
			highest_price NUMERIC(10,2) NOT NULL,
			highest_price_datetime TIMESTAMPTZ NOT NULL,
			regular_price NUMERIC(10,2) NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS images (
			product_id TEXT NOT NULL UNIQUE,
			image BYTEA NOT NULL,
			last_updated TIMESTAMPTZ DEFAULT NOW()
		)`,
	}

	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			panic(err)
		}
	}
	fmt.Println("All tables created successfully.")
}
