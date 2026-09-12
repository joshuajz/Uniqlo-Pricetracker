# Image compression measurements — September 12, 2026

The production Go compressor was tested on every photo in the four local scraper pulls. It encodes JPEG at quality 80 without resizing. An original JPEG is kept when re-encoding would not reduce its size. All source files remained unchanged.

All 5,385 source photos were JPEGs at 1500 × 2000 pixels. Every compressed result was fully decoded and checked for JPEG format and matching dimensions; there were no failures.

| Pull | Photos | Original MB | Compressed MB | Saved MB | Reduction |
| --- | ---: | ---: | ---: | ---: | ---: |
| Canada | 1,085 | 330.22 | 244.95 | 85.27 | 25.82% |
| Uk | 1,411 | 437.92 | 323.01 | 114.91 | 26.24% |
| Japan | 1,663 | 478.10 | 355.56 | 122.54 | 25.63% |
| Us | 1,226 | 382.40 | 281.90 | 100.50 | 26.28% |
| Total | 5,385 | 1628.63 | 1205.42 | 423.22 | 25.99% |

MB uses decimal units (1 MB = 1,000,000 bytes). Exact byte counts and numbers of JPEGs retained unchanged are in [the CSV](reports/image-compression-2026-09-12.csv). Country totals represent the local test collections, not the current production database.

The Canada pull is the relevant estimate for incoming Canadian images: **85.27 MB saved across 1,085 photos**. Older images currently in PostgreSQL may compress differently. These totals exclude PostgreSQL table/index overhead, reusable space from replaced rows, and WAL, so they are not a prediction of the immediate Railway volume size.

Visual checks at 100% compared a striped shirt (E486103-000), a knitted fleece shirt (E479791-000), and a graphic shirt (E482769-000). The results retained good visual detail with minor lossy differences. Resolution is unchanged; JPEG quality 80 is lossy compression, not a lossless setting.

## Reproduce

From `api/`:

```sh
go run ./cmd/image-audit ../scraper/canada/images ../scraper/uk/images ../scraper/japan/images ../scraper/us/images > image-compression.csv
```

The audit imports the same `internal/productimage.Compress` function used by ingestion. It does not connect to PostgreSQL or modify the source images.

## Application behavior and validation

- Prices remain daily; scheduled photo downloads occur on the first day of each month in UTC. Manual `include_images` remains available.
- The API validates and compresses incoming photos before opening the ingestion transaction. Existing stored photos are replaced only when they appear in a subsequent photo upload.
- Go race tests passed against an isolated PostgreSQL 17 database, including actual image storage, photo preservation during price-only updates, rollback, daily replacement, and backfill behavior.
- Compressor tests cover size reduction, dimensions, deterministic output from the same source, retaining smaller JPEGs, PNG transparency, corrupt data, and byte/pixel limits.
- `go vet ./...` and all eight scraper tests passed.
- Production data, deployment settings, and PostgreSQL configuration were not changed during this work.

## WAL behavior

PostgreSQL automatically recycles or removes unneeded WAL segments at checkpoints. It retains a pool based on recent write activity, with `min_wal_size` as a floor. The inspected production configuration had `min_wal_size = 80 MiB`, `max_wal_size = 1 GiB`, and `checkpoint_timeout = 5 minutes`. Its 384 MiB pool may shrink after lighter checkpoint cycles, but it does not reset to zero and cleanup has no guaranteed wall-clock deadline: checkpoints may be skipped if no WAL has been written.

Normal vacuum makes space from old rows available for reuse and generally does not return that space to the filesystem. Compressing incoming images therefore reduces future storage and write demand, but does not immediately reclaim the same number of bytes from the volume.

Sources: [PostgreSQL WAL configuration](https://www.postgresql.org/docs/17/wal-configuration.html), [routine vacuuming](https://www.postgresql.org/docs/17/routine-vacuuming.html).

## Resizing recommendation after inspecting the live site

The live site was inspected on September 12 at 390, 560, 1280, and 1440 pixel
viewport widths. Its desktop detail image has a 310 × 300 CSS box, but
`object-fit: contain` displays the 3:4 photo at **225 × 300 CSS pixels**. On a
390-pixel phone viewport the detail photo displays at **120 × 160** and grid
photos at approximately **145 × 194**. The largest grid photo in the tested
layouts was approximately **217 × 289** at the 560-pixel breakpoint.

**Recommendation: fit incoming photos within 600 × 800 pixels, preserve aspect
ratio, never upscale, and encode at JPEG quality 80.** This supplies 2.67 source
pixels per CSS pixel for the largest detail image, comfortably covering 2×
displays and typical 3× phone grid layouts. A 750 × 1000 version offers more
headroom if the layout grows; 450 × 600 is the smaller 2× desktop option.

A separate temporary Go sizing experiment used `golang.org/x/image/draw`
v0.46.0 with Catmull-Rom resampling and the standard Go JPEG quality-80 encoder.
All **1,085** original Canada photos were tested at each size. All results were
decoded and their target dimensions verified. Original downloads were unchanged.

| Dimensions | Quality | Canada total MB | Reduction vs original | Mean KB/photo |
| --- | ---: | ---: | ---: | ---: |
| Original 1500 × 2000 | Original | 330.22 | — | 304.35 |
| 1500 × 2000 | 80 | 244.95 | 25.82% | 225.76 |
| 450 × 600 | 80 | 26.17 | 92.08% | 24.12 |
| **600 × 800** | **80** | **42.61** | **87.10%** | **39.27** |
| 750 × 1000 | 80 | 63.72 | 80.70% | 58.73 |

Exact resized byte counts are in [the resizing CSV](reports/image-resizing-2026-09-12.csv).
The 600 × 800 option saves **287.61 MB** compared with the original local Canada
pull, or **202.34 MB** beyond the full-resolution quality-80 implementation.
Visual comparisons of a striped polo, knitted fleece, and graphic shirt at the
2× desktop display resolution retained good detail with some fine texture loss.

This section is a measured recommendation. The application compressor still
preserves the original dimensions; the resizing experiment has not changed
application behavior or been deployed. These are image payload measurements,
not immediate PostgreSQL volume reclamation estimates.

Live references: [product detail](https://www.uniqlotracker.com/products/E488280-000),
[product grid](https://www.uniqlotracker.com/).
