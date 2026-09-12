// Package productimage prepares storefront photos for storage and JPEG delivery.
package productimage

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	_ "image/png" // Some storefront image URLs may return PNG data.
)

const (
	JPEGQuality   = 80
	MaxInputBytes = 20 << 20
	maxPixels     = 25_000_000
)

// Compress preserves pixel dimensions and encodes at JPEG quality 80. Valid
// JPEGs that are already smaller are kept byte-for-byte. PNG transparency is
// composited onto white to match the product photo background.
func Compress(original []byte) ([]byte, error) {
	if len(original) > MaxInputBytes {
		return nil, fmt.Errorf("image exceeds %d bytes", MaxInputBytes)
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(original))
	if err != nil {
		return nil, fmt.Errorf("invalid image: %w", err)
	}
	if format != "jpeg" && format != "png" {
		return nil, fmt.Errorf("unsupported image format %q", format)
	}
	if config.Width <= 0 || config.Height <= 0 || config.Width > maxPixels/config.Height {
		return nil, fmt.Errorf("image exceeds %d pixels", maxPixels)
	}
	decoded, _, err := image.Decode(bytes.NewReader(original))
	if err != nil {
		return nil, fmt.Errorf("invalid image: %w", err)
	}
	if format == "png" {
		background := image.NewRGBA(decoded.Bounds())
		draw.Draw(background, background.Bounds(), image.NewUniform(color.White), image.Point{}, draw.Src)
		draw.Draw(background, background.Bounds(), decoded, decoded.Bounds().Min, draw.Over)
		decoded = background
	}
	var compressed bytes.Buffer
	if err := jpeg.Encode(&compressed, decoded, &jpeg.Options{Quality: JPEGQuality}); err != nil {
		return nil, fmt.Errorf("compress image: %w", err)
	}
	if format == "jpeg" && compressed.Len() >= len(original) {
		return original, nil
	}
	return compressed.Bytes(), nil
}
