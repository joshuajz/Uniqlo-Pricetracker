# Database Queries
**SQlite Database:**
CREATE TABLE "images" (
	"product_id"	TEXT NOT NULL,
	"image"	BLOB NOT NULL,
	"last_updated"	TEXT
);

CREATE TABLE "products" (
	"product_id"	TEXT NOT NULL,
	"name"	TEXT NOT NULL,
	"price"	REAL NOT NULL,
	"url"	TEXT NOT NULL,
	"category"	TEXT NOT NULL,
	"datetime"	TEXT NOT NULL
);

CREATE TABLE "scraper" (
	"datetime"	TEXT NOT NULL,
	"scraper_version"	TEXT NOT NULL,
	"total_products"	INTEGER NOT NULL,
	"total_failed"	INTEGER NOT NULL,
	"categories_scraped"	INTEGER NOT NULL,
	"categories"	TEXT NOT NULL
);

CREATE TABLE "stats" (
	"product_id"	TEXT NOT NULL,
	"lowest_price"	REAL
);