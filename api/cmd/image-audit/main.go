// image-audit measures the production compressor against local scraper photos.
// It never modifies the originals or connects to a database.
package main

import (
	"api/internal/productimage"
	"bytes"
	"encoding/csv"
	"flag"
	"fmt"
	"image"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	flag.Parse()
	if flag.NArg() == 0 {
		return fmt.Errorf("usage: image-audit <image-directory> [...]")
	}
	w := csv.NewWriter(os.Stdout)
	if err := w.Write([]string{"directory", "images", "original_bytes", "compressed_bytes", "saved_bytes", "saved_percent", "unchanged_images"}); err != nil {
		return err
	}
	for _, directory := range flag.Args() {
		var count, unchanged int
		var before, after int64
		err := filepath.WalkDir(directory, func(path string, entry fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if entry.IsDir() {
				return nil
			}
			switch strings.ToLower(filepath.Ext(path)) {
			case ".jpg", ".jpeg", ".png":
			default:
				return nil
			}
			info, err := entry.Info()
			if err != nil {
				return err
			}
			if info.Size() > productimage.MaxInputBytes {
				return fmt.Errorf("%s: image exceeds input limit", path)
			}
			original, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			compressed, err := productimage.Compress(original)
			if err != nil {
				return fmt.Errorf("%s: %w", path, err)
			}
			oldConfig, _, err := image.DecodeConfig(bytes.NewReader(original))
			if err != nil {
				return err
			}
			// Decode every result to verify it is a valid JPEG at the same resolution.
			decoded, format, err := image.Decode(bytes.NewReader(compressed))
			if err != nil {
				return fmt.Errorf("%s: compressed image cannot be decoded: %w", path, err)
			}
			if format != "jpeg" || decoded.Bounds().Dx() != oldConfig.Width || decoded.Bounds().Dy() != oldConfig.Height {
				return fmt.Errorf("%s: compressed image format or dimensions changed unexpectedly", path)
			}
			count++
			before += int64(len(original))
			after += int64(len(compressed))
			if bytes.Equal(original, compressed) {
				unchanged++
			}
			if count%250 == 0 {
				fmt.Fprintf(os.Stderr, "%s: checked %d images\n", directory, count)
			}
			return nil
		})
		if err != nil {
			return err
		}
		if count == 0 {
			return fmt.Errorf("%s: no images found", directory)
		}
		if err := w.Write([]string{directory, strconv.Itoa(count), strconv.FormatInt(before, 10), strconv.FormatInt(after, 10), strconv.FormatInt(before-after, 10), fmt.Sprintf("%.2f", 100*float64(before-after)/float64(before)), strconv.Itoa(unchanged)}); err != nil {
			return err
		}
		w.Flush()
		if err := w.Error(); err != nil {
			return err
		}
	}
	return nil
}
