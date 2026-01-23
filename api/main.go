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

// Cache duration
const cacheDuration = 1 * time.Hour

var productsCache = &ProductsCache{}

// Product represents a scraped Uniqlo product
type Product struct {
	ProductID string `json:"product_id"`
	Name      string `json:"name"`
	Price     string `json:"price"`
	URL       string `json:"url"`
	Image     string `json:"image"`
}

// ProductResponse represents a product in the API response with lowest price
type ProductResponse struct {
	ProductID   string  `json:"product_id"`
	Name        string  `json:"name"`
	Price       float64 `json:"price"`
	URL         string  `json:"url"`
	Category    string  `json:"category"`
	Datetime    string  `json:"datetime"`
	LowestPrice float64 `json:"lowest_price"`
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

// updateProductStats updates the stats table with lowest price tracking
// Case 1: Product doesn't exist -> insert with current price as lowest
// Case 2: Product exists and current price < lowest -> update lowest price
// Case 3: Product exists and current price >= lowest -> do nothing
func updateProductStats(db *sql.DB, productID string, currentPrice float64, datetime time.Time) error {
	// Query for existing stats record
	var lowestPrice float64
	err := db.QueryRow("SELECT lowest_price FROM stats WHERE product_id = ?", productID).Scan(&lowestPrice)

	if err == sql.ErrNoRows {
		// Case 1: Product doesn't exist in stats, insert new record
		_, err := db.Exec(
			"INSERT INTO stats (product_id, lowest_price, datetime) VALUES (?, ?, ?)",
			productID, currentPrice, datetime,
		)
		if err != nil {
			return fmt.Errorf("failed to insert stats: %w", err)
		}
		fmt.Printf("Stats: New product %s added with lowest price %.2f\n", productID, currentPrice)
		return nil
	} else if err != nil {
		return fmt.Errorf("failed to query stats: %w", err)
	}

	// Case 2: Product exists and current price is lower than recorded lowest
	if currentPrice < lowestPrice {
		_, err := db.Exec(
			"UPDATE stats SET lowest_price = ?, datetime = ? WHERE product_id = ?",
			currentPrice, datetime, productID,
		)
		if err != nil {
			return fmt.Errorf("failed to update stats: %w", err)
		}
		fmt.Printf("Stats: Product %s updated lowest price from %.2f to %.2f\n", productID, lowestPrice, currentPrice)
		return nil
	}

	// Case 3: Current price >= lowest price, do nothing
	fmt.Printf("Stats: Product %s price %.2f not lower than lowest %.2f, skipping\n", productID, currentPrice, lowestPrice)
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

	// Invalidate products cache after ingesting new data
	productsCache.mu.Lock()
	productsCache.data = nil
	productsCache.expiresAt = time.Time{}
	productsCache.mu.Unlock()

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

	// Query products with the newest datetime and join with stats for lowest_price
	query := `
		SELECT
			p.product_id,
			p.name,
			p.price,
			p.url,
			p.category,
			p.datetime,
			COALESCE(s.lowest_price, p.price) as lowest_price
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
		err := rows.Scan(&p.ProductID, &p.Name, &p.Price, &p.URL, &p.Category, &p.Datetime, &p.LowestPrice)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan product"})
			return
		}
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

func main() {
	router := gin.Default()

	// Public endpoint to get products
	router.GET("/api/products", getProducts)

	// Protected endpoint to ingest scraped data
	router.POST("/api/products/injest", gin.BasicAuth(gin.Accounts{"admin": "password"}), injestProducts)

	router.Run("localhost:8080")
}
