package main

import (
	"archive/zip"
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	_ "github.com/lib/pq"
)

// ProductsCache holds cached products response with expiration
type ProductsCache struct {
	mu        sync.RWMutex
	data      gin.H
	expiresAt time.Time
}

// ProductDetailCache holds cached product detail responses keyed by product ID
type ProductDetailCache struct {
	mu    sync.RWMutex
	cache map[string]productCacheEntry
}

type productCacheEntry struct {
	data      gin.H
	expiresAt time.Time
}

// Cache duration
const cacheDuration = 1 * time.Hour

var productsCache = &ProductsCache{}
var productDetailCache = &ProductDetailCache{cache: make(map[string]productCacheEntry)}

// Product represents a scraped Uniqlo product
type Product struct {
	ProductID string `json:"product_id"`
	Name      string `json:"name"`
	Price     string `json:"price"`
	URL       string `json:"url"`
	Image     string `json:"image"`
}

// ProductResponse represents a product in the API response with price stats
type ProductResponse struct {
	ProductID    string   `json:"product_id"`
	Name         string   `json:"name"`
	Price        float64  `json:"price"`
	URL          string   `json:"url"`
	Categories   []string `json:"categories"`
	Datetime     string   `json:"datetime"`
	LowestPrice  float64  `json:"lowest_price"`
	RegularPrice float64  `json:"regular_price"`
	IsAllTimeLow bool     `json:"is_all_time_low"`
}

// ProductDatapoint represents a single price datapoint for a product
type ProductDatapoint struct {
	Price      float64  `json:"price"`
	Categories []string `json:"categories"`
	Datetime   string   `json:"datetime"`
}

// LowestPriceInfo contains the lowest price information from stats table
type LowestPriceInfo struct {
	LowestPrice float64 `json:"lowest_price"`
	Datetime    string  `json:"lowest_price_datetime"`
}

// HighestPriceInfo contains the highest price information from stats table
type HighestPriceInfo struct {
	HighestPrice float64 `json:"highest_price"`
	Datetime     string  `json:"highest_price_datetime"`
}

// ScraperOutput matches the structure from prices.json
type ScraperOutput struct {
	Metadata struct {
		Datetime          string   `json:"datetime"`
		ScraperVersion    string   `json:"scraper_version"`
		DurationSeconds   float64  `json:"duration_seconds"`
		TotalProducts     int      `json:"total_products"`
		TotalFailed       int      `json:"total_failed"`
		CategoriesScraped int      `json:"categories_scraped"`
		Categories        []string `json:"categories"`
	} `json:"metadata"`
	Products map[string][]Product `json:"products"`
}

var db *sql.DB

// initDB connects to PostgreSQL and creates tables if they don't exist
func initDB() error {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return fmt.Errorf("DATABASE_URL environment variable must be set")
	}

	var err error
	db, err = sql.Open("postgres", databaseURL)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	if err = db.Ping(); err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
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
	}

	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("failed to create table: %w", err)
		}
	}

	fmt.Println("Database initialized successfully")
	return nil
}

// calculateRegularPrice calculates the mode (most frequent price) for a product
func calculateRegularPrice(db *sql.DB, productID string) (float64, error) {
	query := `
		SELECT price, COUNT(*) as count
		FROM products
		WHERE product_id = $1
		GROUP BY price
		ORDER BY count DESC, price DESC
		LIMIT 1
	`
	var regularPrice float64
	var count int
	err := db.QueryRow(query, productID).Scan(&regularPrice, &count)
	if err != nil {
		return 0, fmt.Errorf("failed to calculate regular price: %w", err)
	}
	return regularPrice, nil
}

// updateProductStats updates the stats table with lowest, highest, and regular price tracking
// Case 1: Product doesn't exist -> insert with current price as lowest, highest, and regular
// Case 2: Product exists -> update lowest if current < lowest, update highest if current > highest, recalculate regular
func updateProductStats(db *sql.DB, productID string, currentPrice float64, datetime time.Time) error {
	var lowestPrice, highestPrice float64
	err := db.QueryRow("SELECT lowest_price, highest_price FROM stats WHERE product_id = $1", productID).Scan(&lowestPrice, &highestPrice)

	if err == sql.ErrNoRows {
		_, err := db.Exec(
			"INSERT INTO stats (product_id, lowest_price, lowest_price_datetime, highest_price, highest_price_datetime, regular_price) VALUES ($1, $2, $3, $4, $5, $6)",
			productID, currentPrice, datetime, currentPrice, datetime, currentPrice,
		)
		if err != nil {
			return fmt.Errorf("failed to insert stats: %w", err)
		}
		return nil
	} else if err != nil {
		return fmt.Errorf("failed to query stats: %w", err)
	}

	if currentPrice < lowestPrice {
		_, err := db.Exec(
			"UPDATE stats SET lowest_price = $1, lowest_price_datetime = $2 WHERE product_id = $3",
			currentPrice, datetime, productID,
		)
		if err != nil {
			return fmt.Errorf("failed to update lowest price: %w", err)
		}
	}

	if currentPrice > highestPrice {
		_, err := db.Exec(
			"UPDATE stats SET highest_price = $1, highest_price_datetime = $2 WHERE product_id = $3",
			currentPrice, datetime, productID,
		)
		if err != nil {
			return fmt.Errorf("failed to update highest price: %w", err)
		}
	}

	regularPrice, err := calculateRegularPrice(db, productID)
	if err != nil {
		return fmt.Errorf("failed to calculate regular price: %w", err)
	}

	_, err = db.Exec(
		"UPDATE stats SET regular_price = $1 WHERE product_id = $2",
		regularPrice, productID,
	)
	if err != nil {
		return fmt.Errorf("failed to update regular price: %w", err)
	}

	return nil
}

// injestProducts accepts a ZIP file and extracts product data
func injestProducts(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open file"})
		return
	}
	defer src.Close()

	fileBytes, err := io.ReadAll(src)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}

	zipReader, err := zip.NewReader(bytes.NewReader(fileBytes), int64(len(fileBytes)))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ZIP file"})
		return
	}

	var scraperOutput ScraperOutput
	images := map[string]*zip.File{}
	foundPrices := false

	for _, f := range zipReader.File {
		if f.Name == "prices.json" {
			rc, err := f.Open()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open prices.json"})
				return
			}

			if err := json.NewDecoder(rc).Decode(&scraperOutput); err != nil {
				rc.Close()
				c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse prices.json"})
				return
			}
			rc.Close()
			foundPrices = true
		} else {
			images[f.Name] = f
		}
	}

	if !foundPrices {
		c.JSON(http.StatusBadRequest, gin.H{"error": "prices.json not found in ZIP"})
		return
	}

	// Consolidate products by product_id across categories
	type ConsolidatedProduct struct {
		Product    Product
		Categories []string
		Price      string
	}
	consolidated := map[string]*ConsolidatedProduct{}

	for category, categoryProducts := range scraperOutput.Products {
		for _, product := range categoryProducts {
			if existing, ok := consolidated[product.ProductID]; ok {
				existing.Categories = append(existing.Categories, category)
			} else {
				price := strings.Split(product.Price, "CA $ ")[1]
				consolidated[product.ProductID] = &ConsolidatedProduct{
					Product:    product,
					Categories: []string{category},
					Price:      price,
				}
			}
		}
	}

	// Inject consolidated products into the database
	count := 0
	total := len(consolidated)
	date := time.Now()

	fmt.Printf("Ingesting %d products...\n", total)

	for _, cp := range consolidated {
		count++

		categoriesJSON, err := json.Marshal(cp.Categories)
		if err != nil {
			fmt.Printf("[%d/%d] %s - ERROR marshaling categories: %v\n", count, total, cp.Product.ProductID, err)
			continue
		}

		sqlStmt := "INSERT INTO products (product_id, name, price, url, category, datetime) VALUES ($1, $2, $3, $4, $5, $6)"
		_, err = db.Exec(sqlStmt, cp.Product.ProductID, cp.Product.Name, cp.Price, cp.Product.URL, string(categoriesJSON), date)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to insert product into database", "details": err.Error()})
			return
		}

		// Update stats table with lowest price tracking
		priceFloat, err := strconv.ParseFloat(cp.Price, 64)
		if err != nil {
			fmt.Printf("[%d/%d] %s $%s - WARNING bad price\n", count, total, cp.Product.ProductID, cp.Price)
		} else {
			if err := updateProductStats(db, cp.Product.ProductID, priceFloat, date); err != nil {
				fmt.Printf("[%d/%d] %s $%s - WARNING stats failed: %v\n", count, total, cp.Product.ProductID, cp.Price, err)
			}
		}

		// Save image to database
		imageFile, ok := images[cp.Product.Image]
		if !ok {
			fmt.Printf("[%d/%d] %s $%s - no image\n", count, total, cp.Product.ProductID, cp.Price)
			continue
		}

		rc, err := imageFile.Open()
		if err != nil {
			fmt.Printf("[%d/%d] %s $%s - image read error\n", count, total, cp.Product.ProductID, cp.Price)
			continue
		}

		imageBytes, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			fmt.Printf("[%d/%d] %s $%s - image read error\n", count, total, cp.Product.ProductID, cp.Price)
			continue
		}

		_, err = db.Exec(
			`INSERT INTO images (product_id, image) VALUES ($1, $2)
			 ON CONFLICT (product_id) DO UPDATE SET image = EXCLUDED.image, last_updated = NOW()`,
			cp.Product.ProductID, imageBytes,
		)
		if err != nil {
			fmt.Printf("[%d/%d] %s $%s - image save error: %v\n", count, total, cp.Product.ProductID, cp.Price, err)
			continue
		}

		fmt.Printf("[%d/%d] %s $%s OK\n", count, total, cp.Product.ProductID, cp.Price)
	}

	// Insert scraper run metadata into scraper table
	categoriesStr := strings.Join(scraperOutput.Metadata.Categories, ",")
	scraperDatetime, err := time.Parse(time.RFC3339, scraperOutput.Metadata.Datetime)
	if err != nil {
		scraperDatetime = date
	}
	_, err = db.Exec(
		"INSERT INTO scraper (datetime, scraper_version, total_products, total_failed, categories_scraped, categories) VALUES ($1, $2, $3, $4, $5, $6)",
		scraperDatetime,
		scraperOutput.Metadata.ScraperVersion,
		scraperOutput.Metadata.TotalProducts,
		scraperOutput.Metadata.TotalFailed,
		scraperOutput.Metadata.CategoriesScraped,
		categoriesStr,
	)
	if err != nil {
		fmt.Printf("WARNING: failed to insert scraper stats: %v\n", err)
	}

	// Invalidate caches after ingesting new data
	productsCache.mu.Lock()
	productsCache.data = nil
	productsCache.expiresAt = time.Time{}
	productsCache.mu.Unlock()

	productDetailCache.mu.Lock()
	productDetailCache.cache = make(map[string]productCacheEntry)
	productDetailCache.mu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"message":    "Products ingested successfully",
		"count":      count,
		"categories": len(scraperOutput.Products),
		"metadata":   scraperOutput.Metadata,
	})
}

// getProducts returns all products from the most recent scrape with their lowest prices
func getProducts(c *gin.Context) {
	// Check cache first
	productsCache.mu.RLock()
	if productsCache.data != nil && time.Now().Before(productsCache.expiresAt) {
		cachedData := productsCache.data
		productsCache.mu.RUnlock()
		c.JSON(http.StatusOK, cachedData)
		return
	}
	productsCache.mu.RUnlock()

	// Get the newest datetime from products table
	var newestDatetime sql.NullTime
	err := db.QueryRow("SELECT MAX(datetime) FROM products").Scan(&newestDatetime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get newest datetime"})
		return
	}

	if !newestDatetime.Valid {
		c.JSON(http.StatusOK, gin.H{"products": []ProductResponse{}, "datetime": nil})
		return
	}

	// Query products with the newest datetime and join with stats for lowest_price and regular_price
	query := `
		SELECT
			p.product_id,
			p.name,
			p.price,
			p.url,
			p.category,
			p.datetime,
			COALESCE(s.lowest_price, p.price) as lowest_price,
			COALESCE(s.regular_price, p.price) as regular_price
		FROM products p
		LEFT JOIN stats s ON p.product_id = s.product_id
		WHERE p.datetime = $1
	`

	rows, err := db.Query(query, newestDatetime.Time)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query products"})
		return
	}
	defer rows.Close()

	var products []ProductResponse
	for rows.Next() {
		var p ProductResponse
		var categoryJSON string
		var datetime time.Time
		err := rows.Scan(&p.ProductID, &p.Name, &p.Price, &p.URL, &categoryJSON, &datetime, &p.LowestPrice, &p.RegularPrice)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan product"})
			return
		}
		p.Datetime = datetime.Format(time.RFC3339)
		if err := json.Unmarshal([]byte(categoryJSON), &p.Categories); err != nil {
			p.Categories = []string{categoryJSON}
		}
		p.IsAllTimeLow = p.Price <= p.LowestPrice
		products = append(products, p)
	}

	if err = rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error iterating products"})
		return
	}

	// Build response and cache it
	response := gin.H{
		"datetime": newestDatetime.Time.Format(time.RFC3339),
		"count":    len(products),
		"products": products,
	}

	productsCache.mu.Lock()
	productsCache.data = response
	productsCache.expiresAt = time.Now().Add(cacheDuration)
	productsCache.mu.Unlock()

	c.JSON(http.StatusOK, response)
}

// getProductImage returns the product image as JPEG from the database
func getProductImage(c *gin.Context) {
	productID := c.Param("id")
	if productID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Product ID is required"})
		return
	}

	var imageBytes []byte
	err := db.QueryRow("SELECT image FROM images WHERE product_id = $1", productID).Scan(&imageBytes)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Image not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve image"})
		return
	}

	c.Header("Cache-Control", "public, max-age=86400")
	c.Data(http.StatusOK, "image/jpeg", imageBytes)
}

// getProduct returns all datapoints and lowest price info for a specific product ID
func getProduct(c *gin.Context) {
	productID := c.Param("id")
	if productID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Product ID is required"})
		return
	}

	// Check cache first
	productDetailCache.mu.RLock()
	if entry, ok := productDetailCache.cache[productID]; ok && time.Now().Before(entry.expiresAt) {
		cachedData := entry.data
		productDetailCache.mu.RUnlock()
		c.JSON(http.StatusOK, cachedData)
		return
	}
	productDetailCache.mu.RUnlock()

	// Get all datapoints for this product
	query := `
		SELECT price, category, datetime
		FROM products
		WHERE product_id = $1
		ORDER BY datetime ASC
	`

	rows, err := db.Query(query, productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query product datapoints"})
		return
	}
	defer rows.Close()

	var datapoints []ProductDatapoint
	var name, url string

	for rows.Next() {
		var dp ProductDatapoint
		var categoryJSON string
		var datetime time.Time
		err := rows.Scan(&dp.Price, &categoryJSON, &datetime)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan datapoint"})
			return
		}
		dp.Datetime = datetime.Format(time.RFC3339)
		if err := json.Unmarshal([]byte(categoryJSON), &dp.Categories); err != nil {
			dp.Categories = []string{categoryJSON}
		}
		datapoints = append(datapoints, dp)
	}

	if err = rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error iterating datapoints"})
		return
	}

	if len(datapoints) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}

	// Get product name and URL from the most recent entry
	err = db.QueryRow("SELECT name, url FROM products WHERE product_id = $1 ORDER BY datetime DESC LIMIT 1", productID).Scan(&name, &url)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get product details"})
		return
	}

	// Get lowest, highest, and regular price info from stats table
	var lowestPriceInfo LowestPriceInfo
	var highestPriceInfo HighestPriceInfo
	var regularPrice float64
	var lowestDatetime, highestDatetime time.Time
	err = db.QueryRow(
		"SELECT lowest_price, lowest_price_datetime, highest_price, highest_price_datetime, regular_price FROM stats WHERE product_id = $1",
		productID,
	).Scan(&lowestPriceInfo.LowestPrice, &lowestDatetime, &highestPriceInfo.HighestPrice, &highestDatetime, &regularPrice)
	if err == sql.ErrNoRows {
		// If no stats entry, calculate from datapoints
		minPrice := datapoints[0].Price
		minDatetime := datapoints[0].Datetime
		maxPrice := datapoints[0].Price
		maxDatetime := datapoints[0].Datetime
		priceCount := make(map[float64]int)
		for _, dp := range datapoints {
			if dp.Price < minPrice {
				minPrice = dp.Price
				minDatetime = dp.Datetime
			}
			if dp.Price > maxPrice {
				maxPrice = dp.Price
				maxDatetime = dp.Datetime
			}
			priceCount[dp.Price]++
		}
		lowestPriceInfo.LowestPrice = minPrice
		lowestPriceInfo.Datetime = minDatetime
		highestPriceInfo.HighestPrice = maxPrice
		highestPriceInfo.Datetime = maxDatetime
		maxCount := 0
		for price, count := range priceCount {
			if count > maxCount || (count == maxCount && price > regularPrice) {
				maxCount = count
				regularPrice = price
			}
		}
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get price stats"})
		return
	} else {
		lowestPriceInfo.Datetime = lowestDatetime.Format(time.RFC3339)
		highestPriceInfo.Datetime = highestDatetime.Format(time.RFC3339)
	}

	// Determine if product is on sale (current price < regular price)
	currentPrice := datapoints[len(datapoints)-1].Price
	onSale := currentPrice < regularPrice
	isAllTimeLow := currentPrice <= lowestPriceInfo.LowestPrice

	// Build response and cache it
	response := gin.H{
		"product_id":      productID,
		"name":            name,
		"url":             url,
		"datapoints":      datapoints,
		"lowest_price":    lowestPriceInfo,
		"highest_price":   highestPriceInfo,
		"regular_price":   regularPrice,
		"current_price":   currentPrice,
		"on_sale":         onSale,
		"is_all_time_low": isAllTimeLow,
	}

	productDetailCache.mu.Lock()
	productDetailCache.cache[productID] = productCacheEntry{
		data:      response,
		expiresAt: time.Now().Add(cacheDuration),
	}
	productDetailCache.mu.Unlock()

	c.JSON(http.StatusOK, response)
}

// getProductsByCategory returns all products from the most recent scrape filtered by category
func getProductsByCategory(c *gin.Context) {
	category := c.Param("category")
	if category == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Category is required"})
		return
	}

	// Get the newest datetime from products table
	var newestDatetime sql.NullTime
	err := db.QueryRow("SELECT MAX(datetime) FROM products").Scan(&newestDatetime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get newest datetime"})
		return
	}

	if !newestDatetime.Valid {
		c.JSON(http.StatusOK, gin.H{"products": []ProductResponse{}, "datetime": nil, "category": category})
		return
	}

	// Query products with the newest datetime filtered by category using JSONB contains and join with stats
	categoryFilter, _ := json.Marshal([]string{category})

	query := `
		SELECT
			p.product_id,
			p.name,
			p.price,
			p.url,
			p.category,
			p.datetime,
			COALESCE(s.lowest_price, p.price) as lowest_price,
			COALESCE(s.regular_price, p.price) as regular_price
		FROM products p
		LEFT JOIN stats s ON p.product_id = s.product_id
		WHERE p.datetime = $1 AND p.category @> $2::jsonb
	`

	rows, err := db.Query(query, newestDatetime.Time, string(categoryFilter))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query products"})
		return
	}
	defer rows.Close()

	var products []ProductResponse
	for rows.Next() {
		var p ProductResponse
		var categoryJSON string
		var datetime time.Time
		err := rows.Scan(&p.ProductID, &p.Name, &p.Price, &p.URL, &categoryJSON, &datetime, &p.LowestPrice, &p.RegularPrice)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan product"})
			return
		}
		p.Datetime = datetime.Format(time.RFC3339)
		if err := json.Unmarshal([]byte(categoryJSON), &p.Categories); err != nil {
			p.Categories = []string{categoryJSON}
		}
		p.IsAllTimeLow = p.Price <= p.LowestPrice
		products = append(products, p)
	}

	if err = rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error iterating products"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"datetime": newestDatetime.Time.Format(time.RFC3339),
		"category": category,
		"count":    len(products),
		"products": products,
	})
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		allowedOrigins := os.Getenv("CORS_ORIGINS") // comma-separated list, e.g. "https://uniqlotracker.com,http://localhost:5173"
		if allowedOrigins == "" {
			allowedOrigins = "http://localhost:5173" // default for local dev
		}

		for _, allowed := range strings.Split(allowedOrigins, ",") {
			if strings.TrimSpace(allowed) == origin {
				c.Header("Access-Control-Allow-Origin", origin)
				break
			}
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func main() {
	// Initialize database on startup
	if err := initDB(); err != nil {
		panic(fmt.Sprintf("Failed to initialize database: %v", err))
	}
	defer db.Close()

	router := gin.Default()
	router.Use(corsMiddleware())

	// Public endpoint to get products
	router.GET("/api/products", getProducts)

	// Public endpoint to get products by category
	router.GET("/api/category/:category", getProductsByCategory)

	// Public endpoint to get single product with all datapoints
	router.GET("/api/product/:id", getProduct)

	// Public endpoint to get product image
	router.GET("/api/product/:id/image", getProductImage)

	// Protected endpoint to ingest scraped data
	authUser := os.Getenv("AUTH_USER")
	authPass := os.Getenv("AUTH_PASS")
	if authUser == "" || authPass == "" {
		panic("AUTH_USER and AUTH_PASS environment variables must be set")
	}
	router.POST("/api/products/injest", gin.BasicAuth(gin.Accounts{authUser: authPass}), injestProducts)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	router.Run("0.0.0.0:" + port)
}
