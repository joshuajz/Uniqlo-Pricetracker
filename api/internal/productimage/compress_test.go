package productimage

import (
	"bytes"
	"encoding/binary"
	"hash/crc32"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"math/rand"
	"testing"
)

func photo(t *testing.T, quality int) []byte {
	t.Helper()
	im := image.NewRGBA(image.Rect(0, 0, 180, 240))
	rng := rand.New(rand.NewSource(7))
	for y := 0; y < 240; y++ {
		for x := 0; x < 180; x++ {
			im.SetRGBA(x, y, color.RGBA{uint8(rng.Intn(256)), uint8(x), uint8(y), 255})
		}
	}
	var buffer bytes.Buffer
	if err := jpeg.Encode(&buffer, im, &jpeg.Options{Quality: quality}); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

func TestCompressPreservesDimensionsAndReducesLargeJPEG(t *testing.T) {
	original := photo(t, 98)
	compressed, err := Compress(original)
	if err != nil {
		t.Fatal(err)
	}
	if len(compressed) >= len(original)/2 {
		t.Fatalf("expected substantial reduction: %d -> %d", len(original), len(compressed))
	}
	im, err := jpeg.Decode(bytes.NewReader(compressed))
	if err != nil || im.Bounds() != image.Rect(0, 0, 180, 240) {
		t.Fatalf("invalid compressed image or changed dimensions: %v", err)
	}
	// The same source must produce identical stored bytes on retry.
	retry, err := Compress(original)
	if err != nil || !bytes.Equal(retry, compressed) {
		t.Fatalf("non-deterministic compression: %v", err)
	}
}

func TestAlreadySmallJPEGIsUnchanged(t *testing.T) {
	original := photo(t, 20)
	compressed, err := Compress(original)
	if err != nil || !bytes.Equal(original, compressed) {
		t.Fatalf("small JPEG was enlarged or re-encoded: %v", err)
	}
}

func TestPNGBecomesJPEGWithWhiteBackground(t *testing.T) {
	im := image.NewNRGBA(image.Rect(0, 0, 32, 48))
	var original bytes.Buffer
	if err := png.Encode(&original, im); err != nil {
		t.Fatal(err)
	}
	compressed, err := Compress(original.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := jpeg.Decode(bytes.NewReader(compressed))
	if err != nil || decoded.Bounds() != im.Bounds() {
		t.Fatalf("PNG conversion: %v", err)
	}
	r, g, b, a := decoded.At(16, 24).RGBA()
	if r < 65000 || g < 65000 || b < 65000 || a != 65535 {
		t.Fatalf("transparent background was not white: %d %d %d %d", r, g, b, a)
	}
}

func TestRejectInvalidOrExcessiveImage(t *testing.T) {
	// A valid PNG header with excessive dimensions must be rejected before a
	// full decode can allocate its claimed pixel buffer.
	var huge bytes.Buffer
	huge.WriteString("\x89PNG\r\n\x1a\n")
	header := make([]byte, 17)
	copy(header, "IHDR")
	binary.BigEndian.PutUint32(header[4:8], 6000)
	binary.BigEndian.PutUint32(header[8:12], 6000)
	header[12], header[13] = 8, 2
	binary.Write(&huge, binary.BigEndian, uint32(13))
	huge.Write(header)
	binary.Write(&huge, binary.BigEndian, crc32.ChecksumIEEE(header))
	valid := photo(t, 95)
	for name, data := range map[string][]byte{
		"empty":           nil,
		"not an image":    []byte("<html>upstream error</html>"),
		"truncated JPEG":  valid[:len(valid)/2],
		"too many bytes":  make([]byte, MaxInputBytes+1),
		"too many pixels": huge.Bytes(),
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := Compress(data); err == nil {
				t.Fatal("accepted invalid image")
			}
		})
	}
}
