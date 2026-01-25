package main

import (
	"archive/zip"
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	_ "modernc.org/sqlite"
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
	ProductID    string  `json:"product_id"`
	Name         string  `json:"name"`
	Price        float64 `json:"price"`
	URL          string  `json:"url"`
	Category     string  `json:"category"`
	Datetime     string  `json:"datetime"`
	LowestPrice  float64 `json:"lowest_price"`
	RegularPrice float64 `json:"regular_price"`
	IsAllTimeLow bool    `json:"is_all_time_low"`
}

// ProductDatapoint represents a single price datapoint for a product
type ProductDatapoint struct {
	Price    float64 `json:"price"`
	Category string  `json:"category"`
	Datetime string  `json:"datetime"`
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

type Image struct {
	ImagePath string
	File      zip.File
}

// calculateRegularPrice calculates the mode (most frequent price) for a product
func calculateRegularPrice(db *sql.DB, productID string) (float64, error) {
	// Query to find the most frequent price for this product
	query := `
		SELECT price, COUNT(*) as count
		FROM products
		WHERE product_id = ?
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
	// Query for existing stats record
	var lowestPrice, highestPrice float64
	err := db.QueryRow("SELECT lowest_price, highest_price FROM stats WHERE product_id = ?", productID).Scan(&lowestPrice, &highestPrice)

	if err == sql.ErrNoRows {
		// Case 1: Product doesn't exist in stats, insert new record with current price as lowest, highest, and regular
		_, err := db.Exec(
			"INSERT INTO stats (product_id, lowest_price, lowest_price_datetime, highest_price, highest_price_datetime, regular_price) VALUES (?, ?, ?, ?, ?, ?)",
			productID, currentPrice, datetime, currentPrice, datetime, currentPrice,
		)
		if err != nil {
			return fmt.Errorf("failed to insert stats: %w", err)
		}
		fmt.Printf("Stats: New product %s added with price %.2f (lowest, highest, and regular)\n", productID, currentPrice)
		return nil
	} else if err != nil {
		return fmt.Errorf("failed to query stats: %w", err)
	}

	// Case 2: Product exists, check if we need to update lowest or highest
	if currentPrice < lowestPrice {
		_, err := db.Exec(
			"UPDATE stats SET lowest_price = ?, lowest_price_datetime = ? WHERE product_id = ?",
			currentPrice, datetime, productID,
		)
		if err != nil {
			return fmt.Errorf("failed to update lowest price: %w", err)
		}
		fmt.Printf("Stats: Product %s updated lowest price from %.2f to %.2f\n", productID, lowestPrice, currentPrice)
	}

	if currentPrice > highestPrice {
		_, err := db.Exec(
			"UPDATE stats SET highest_price = ?, highest_price_datetime = ? WHERE product_id = ?",
			currentPrice, datetime, productID,
		)
		if err != nil {
			return fmt.Errorf("failed to update highest price: %w", err)
		}
		fmt.Printf("Stats: Product %s updated highest price from %.2f to %.2f\n", productID, highestPrice, currentPrice)
	}

	// Always recalculate regular price (mode) after adding new datapoint
	regularPrice, err := calculateRegularPrice(db, productID)
	if err != nil {
		return fmt.Errorf("failed to calculate regular price: %w", err)
	}

	_, err = db.Exec(
		"UPDATE stats SET regular_price = ? WHERE product_id = ?",
		regularPrice, productID,
	)
	if err != nil {
		return fmt.Errorf("failed to update regular price: %w", err)
	}
	fmt.Printf("Stats: Product %s regular price updated to %.2f\n", productID, regularPrice)

	return nil
}

// injestProducts accepts a ZIP file and extracts product data
func injestProducts(c *gin.Context) {
	// Get the uploaded file
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// Open the uploaded file
	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open file"})
		return
	}
	defer src.Close()

	// Read file into memory
	fileBytes, err := io.ReadAll(src)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}

	// Open as ZIP archive
	zipReader, err := zip.NewReader(bytes.NewReader(fileBytes), int64(len(fileBytes)))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ZIP file"})
		return
	}

	// Find and parse prices.json
	var scraperOutput ScraperOutput

	images := map[string]*zip.File{}
	foundPrices := false

	for _, f := range zipReader.File {
		fmt.Println("f.name:", f.Name)
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
			fmt.Println("f.Name:", f.Name)
			images[f.Name] = f
		}
	}

	if !foundPrices {
		c.JSON(http.StatusBadRequest, gin.H{"error": "prices.json not found in ZIP"})
		return
	}

	db, err := sql.Open("sqlite", "database/products.db")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to database"})
		return
	}
	// Inject products into the database
	count := 0

	date := time.Now()
	for category, categoryProducts := range scraperOutput.Products {
		for _, product := range categoryProducts {
			sql := "INSERT INTO products (product_id, name, price, url, category, datetime) VALUES (?, ?, ?, ?, ?, ?);"

			price := strings.Split(product.Price, "CA $ ")[1]

			_, err := db.Exec(sql, product.ProductID, product.Name, price, product.URL, category, date)

			if err != nil {
				fmt.Println("Error:", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to insert product into database", "details": err.Error()})
				return
			}

			// Update stats table with lowest price tracking
			priceFloat, err := strconv.ParseFloat(price, 64)
			if err != nil {
				fmt.Println("Warning: Failed to parse price for stats:", err)
			} else {
				if err := updateProductStats(db, product.ProductID, priceFloat, date); err != nil {
					fmt.Println("Warning: Failed to update stats:", err)
				}
			}

			fmt.Println("Category:", category, "Product:", product)
			fmt.Println("Image:", product.Image)

			imageFile, ok := images[product.Image]
			if !ok {
				fmt.Println("Warning: Image not found in ZIP:", product.Image)
				continue
			}

			rc, err := imageFile.Open()
			if err != nil {
				fmt.Println("Warning: Failed to open image:", err)
				continue
			}

			imageBytes, err := io.ReadAll(rc)
			rc.Close()
			if err != nil {
				fmt.Println("Warning: Failed to read image:", err)
				continue
			}

			image_sql := "INSERT INTO images (product_id, image, last_updated) VALUES (?, ?, ?);"
			_, err = db.Exec(image_sql, product.ProductID, imageBytes, date)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to insert image into database", "details": err.Error()})
				return
			}
		}
		count += len(categoryProducts)
	}
	db.Close()

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

	// Cache miss or expired, fetch from database
	db, err := sql.Open("sqlite", "database/products.db")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to database"})
		return
	}
	defer db.Close()

	// Get the newest datetime from products table
	var newestDatetime string
	err = db.QueryRow("SELECT MAX(datetime) FROM products").Scan(&newestDatetime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get newest datetime"})
		return
	}

	if newestDatetime == "" {
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
		WHERE p.datetime = ?
	`

	rows, err := db.Query(query, newestDatetime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query products"})
		return
	}
	defer rows.Close()

	var products []ProductResponse
	for rows.Next() {
		var p ProductResponse
		err := rows.Scan(&p.ProductID, &p.Name, &p.Price, &p.URL, &p.Category, &p.Datetime, &p.LowestPrice, &p.RegularPrice)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan product"})
			return
		}
		// Product is at all-time low if current price equals the lowest recorded price
		p.IsAllTimeLow = p.Price <= p.LowestPrice
		products = append(products, p)
	}

	if err = rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error iterating products"})
		return
	}

	// Build response and cache it
	response := gin.H{
		"datetime": newestDatetime,
		"count":    len(products),
		"products": products,
	}

	productsCache.mu.Lock()
	productsCache.data = response
	productsCache.expiresAt = time.Now().Add(cacheDuration)
	productsCache.mu.Unlock()

	c.JSON(http.StatusOK, response)
}

// getProductImage returns the product image as JPEG
func getProductImage(c *gin.Context) {
	productID := c.Param("id")
	if productID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Product ID is required"})
		return
	}

	db, err := sql.Open("sqlite", "database/products.db")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to database"})
		return
	}
	defer db.Close()

	var imageData []byte
	err = db.QueryRow("SELECT image FROM images WHERE product_id = ?", productID).Scan(&imageData)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Image not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query image"})
		return
	}

	c.Header("Cache-Control", "public, max-age=86400") // Cache for 24 hours
	c.Data(http.StatusOK, "image/jpeg", imageData)
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

	// Cache miss or expired, fetch from database
	db, err := sql.Open("sqlite", "database/products.db")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to database"})
		return
	}
	defer db.Close()

	// Get all datapoints for this product
	query := `
		SELECT price, category, datetime
		FROM products
		WHERE product_id = ?
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
		err := rows.Scan(&dp.Price, &dp.Category, &dp.Datetime)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan datapoint"})
			return
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
	err = db.QueryRow("SELECT name, url FROM products WHERE product_id = ? ORDER BY datetime DESC LIMIT 1", productID).Scan(&name, &url)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get product details"})
		return
	}

	// Get lowest, highest, and regular price info from stats table
	var lowestPriceInfo LowestPriceInfo
	var highestPriceInfo HighestPriceInfo
	var regularPrice float64
	err = db.QueryRow(
		"SELECT lowest_price, lowest_price_datetime, highest_price, highest_price_datetime, regular_price FROM stats WHERE product_id = ?",
		productID,
	).Scan(&lowestPriceInfo.LowestPrice, &lowestPriceInfo.Datetime, &highestPriceInfo.HighestPrice, &highestPriceInfo.Datetime, &regularPrice)
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
		// Calculate mode for regular price
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
	}

	// Determine if product is on sale (current price < regular price)
	currentPrice := datapoints[len(datapoints)-1].Price
	onSale := currentPrice < regularPrice
	// Product is at all-time low if current price equals the lowest recorded price
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

	db, err := sql.Open("sqlite", "database/products.db")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to database"})
		return
	}
	defer db.Close()

	// Get the newest datetime from products table
	var newestDatetime string
	err = db.QueryRow("SELECT MAX(datetime) FROM products").Scan(&newestDatetime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get newest datetime"})
		return
	}

	if newestDatetime == "" {
		c.JSON(http.StatusOK, gin.H{"products": []ProductResponse{}, "datetime": nil, "category": category})
		return
	}

	// Query products with the newest datetime filtered by category and join with stats
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
		WHERE p.datetime = ? AND p.category = ?
	`

	rows, err := db.Query(query, newestDatetime, category)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query products"})
		return
	}
	defer rows.Close()

	var products []ProductResponse
	for rows.Next() {
		var p ProductResponse
		err := rows.Scan(&p.ProductID, &p.Name, &p.Price, &p.URL, &p.Category, &p.Datetime, &p.LowestPrice, &p.RegularPrice)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan product"})
			return
		}
		p.IsAllTimeLow = p.Price <= p.LowestPrice
		products = append(products, p)
	}

	if err = rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error iterating products"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"datetime": newestDatetime,
		"category": category,
		"count":    len(products),
		"products": products,
	})
}

func main() {
	router := gin.Default()

	// Public endpoint to get products
	router.GET("/api/products", getProducts)

	// Public endpoint to get products by category
	router.GET("/api/category/:category", getProductsByCategory)

	// Public endpoint to get single product with all datapoints
	router.GET("/api/product/:id", getProduct)

	// Public endpoint to get product image
	router.GET("/api/product/:id/image", getProductImage)

	// Protected endpoint to ingest scraped data
	router.POST("/api/products/injest", gin.BasicAuth(gin.Accounts{"admin": "password"}), injestProducts)

	router.Run("localhost:8080")
}
