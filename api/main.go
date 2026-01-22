package main

import (
	"archive/zip"
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	_ "modernc.org/sqlite"
)

// Product represents a scraped Uniqlo product
type Product struct {
	ProductID string `json:"product_id"`
	Name      string `json:"name"`
	Price     string `json:"price"`
	URL       string `json:"url"`
	Image     string `json:"image"`
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

	c.JSON(http.StatusOK, gin.H{
		"message":    "Products ingested successfully",
		"count":      count,
		"categories": len(scraperOutput.Products),
		"metadata":   scraperOutput.Metadata,
	})
}
func main() {
	router := gin.Default()

	// Protected endpoint to ingest scraped data
	router.POST("/api/products/injest", gin.BasicAuth(gin.Accounts{"admin": "password"}), injestProducts)

	router.Run("localhost:8080")
}
