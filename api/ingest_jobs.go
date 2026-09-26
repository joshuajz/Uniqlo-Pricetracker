package main

import (
	"archive/zip"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const maxArchiveBytes = 1 << 30

type ingestQueue struct {
	database *sql.DB
	spool    string
}

type ingestJob struct {
	ID     string `json:"id"`
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

func initializeIngestJobs(database *sql.DB) error {
	_, err := database.Exec(`CREATE TABLE IF NOT EXISTS ingest_jobs (
		id TEXT PRIMARY KEY,
		status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed')),
		error TEXT NOT NULL DEFAULT '',
		created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
		finished_at TIMESTAMPTZ,
		archive_removed BOOLEAN NOT NULL DEFAULT false
	)`)
	return err
}

func newIngestQueue(database *sql.DB, spool string) (*ingestQueue, error) {
	if err := os.MkdirAll(spool, 0700); err != nil {
		return nil, fmt.Errorf("create persistent ingest spool: %w", err)
	}
	return &ingestQueue{database: database, spool: spool}, nil
}

func (q *ingestQueue) registerRoutes(router *gin.Engine, user, password string) {
	group := router.Group("/api/ingest/jobs", gin.BasicAuth(gin.Accounts{user: password}))
	group.POST("", q.submit)
	group.GET("/:id", q.status)
}

func (q *ingestQueue) lookup(ctx context.Context, id string) (ingestJob, error) {
	job := ingestJob{ID: id}
	err := q.database.QueryRowContext(ctx, `SELECT status,error FROM ingest_jobs WHERE id=$1`, id).Scan(&job.Status, &job.Error)
	return job, err
}

func (q *ingestQueue) status(c *gin.Context) {
	id := c.Param("id")
	decoded, err := hex.DecodeString(id)
	if err != nil || len(decoded) != sha256.Size {
		c.JSON(http.StatusNotFound, gin.H{"error": "Import job not found"})
		return
	}
	job, err := q.lookup(c.Request.Context(), id)
	if errors.Is(err, sql.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Import job not found"})
	} else if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Import queue unavailable"})
	} else {
		c.Header("Cache-Control", "no-store")
		c.JSON(http.StatusOK, job)
	}
}

// Acknowledgement happens only after both the archive and its queue row are
// durable. The hash identifies retries, including a lost acknowledgement.
func (q *ingestQueue) submit(c *gin.Context) {
	if c.ContentType() != "application/zip" {
		c.JSON(http.StatusUnsupportedMediaType, gin.H{"error": "Send the ZIP as application/zip"})
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxArchiveBytes)
	file, err := os.CreateTemp(q.spool, ".upload-*")
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Import storage unavailable"})
		return
	}
	defer os.Remove(file.Name())
	defer file.Close()
	hash := sha256.New()
	size, err := io.Copy(io.MultiWriter(file, hash), c.Request.Body)
	if err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "Archive exceeds 1 GiB"})
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Could not receive archive"})
		}
		return
	}
	if _, err := zip.NewReader(file, size); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ZIP file"})
		return
	}
	if err := file.Sync(); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Could not persist archive"})
		return
	}
	id := hex.EncodeToString(hash.Sum(nil))
	err = q.enqueue(c.Request.Context(), id, file.Name())
	if err != nil {
		fmt.Printf("Queue import: %v\n", err)
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Could not queue import; retry the same archive"})
		return
	}
	job, err := q.lookup(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Could not read queued import; retry the same archive"})
		return
	}
	c.Header("Location", "/api/ingest/jobs/"+id)
	c.JSON(http.StatusAccepted, job)
}

func (q *ingestQueue) enqueue(ctx context.Context, id, temporary string) error {
	// Reads see the committed pending state even while a worker holds the row
	// lock. A duplicate upload must not wait for image processing to finish.
	if _, err := q.lookup(ctx, id); err == nil {
		return nil
	} else if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	tx, err := q.database.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `INSERT INTO ingest_jobs(id) VALUES($1) ON CONFLICT DO NOTHING`, id)
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if n == 1 {
		if err := os.Rename(temporary, filepath.Join(q.spool, id+".zip")); err != nil {
			return err
		}
		dir, err := os.Open(q.spool)
		if err != nil {
			return err
		}
		err = dir.Sync()
		dir.Close()
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func prepareArchive(ctx context.Context, reader *zip.Reader) (preparedIngest, error) {
	var output ScraperOutput
	images := map[string]*zip.File{}
	found := false
	for _, file := range reader.File {
		if file.Name != "prices.json" {
			images[file.Name] = file
			continue
		}
		if found {
			return preparedIngest{}, errors.New("duplicate prices.json")
		}
		found = true
		if file.UncompressedSize64 > 32<<20 {
			return preparedIngest{}, errors.New("prices.json exceeds 32 MiB")
		}
		r, err := file.Open()
		if err != nil {
			return preparedIngest{}, err
		}
		err = json.NewDecoder(io.LimitReader(r, (32<<20)+1)).Decode(&output)
		r.Close()
		if err != nil {
			return preparedIngest{}, fmt.Errorf("invalid prices.json: %w", err)
		}
	}
	if !found {
		return preparedIngest{}, errors.New("prices.json not found in ZIP")
	}
	return prepareIngestContext(ctx, output, images)
}

func (q *ingestQueue) run(ctx context.Context) {
	for ctx.Err() == nil {
		worked, err := q.processNext(ctx)
		if ctx.Err() != nil {
			return
		}
		if err != nil {
			fmt.Printf("Import worker: %v\n", err)
		}
		if worked && err == nil {
			continue
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(2 * time.Second):
		}
	}
}

// The transaction owns the worker lock through preparation and persistence.
// A crash rolls it back, leaving the durable job pending for the next worker.
// Import writes and the success marker commit together, so recovery cannot
// mistake an uncommitted import for a completed one.
func (q *ingestQueue) processNext(ctx context.Context) (bool, error) {
	tx, err := q.database.BeginTx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer tx.Rollback()
	var locked bool
	if err := tx.QueryRowContext(ctx, `SELECT pg_try_advisory_xact_lock(817424)`).Scan(&locked); err != nil {
		return false, err
	}
	if !locked {
		return false, nil
	}
	if err := q.cleanup(ctx, tx); err != nil {
		return false, err
	}
	var id string
	err = tx.QueryRowContext(ctx, `SELECT id FROM ingest_jobs WHERE status='pending' ORDER BY created_at,id LIMIT 1 FOR UPDATE`).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return false, tx.Commit()
	}
	if err != nil {
		return false, err
	}
	fmt.Printf("Import %s: preparing archive\n", id)
	reader, err := zip.OpenReader(filepath.Join(q.spool, id+".zip"))
	// A missing/unavailable persistent volume is recoverable; never mark its
	// jobs failed or discard them just because storage is temporarily absent.
	if err != nil {
		return false, err
	}
	prepared, prepareErr := prepareArchive(ctx, &reader.Reader)
	reader.Close()
	if ctx.Err() != nil {
		return false, ctx.Err()
	}
	jobError := ""
	if prepareErr != nil {
		jobError = prepareErr.Error()
	} else {
		fmt.Printf("Import %s: storing %d products\n", id, len(prepared.products))
		if _, err := tx.ExecContext(ctx, "SAVEPOINT import_data"); err != nil {
			return false, err
		}
		if err := persistIngestTx(ctx, tx, prepared); err != nil {
			fmt.Printf("Import %s rolled back: %v\n", id, err)
			if _, rollbackErr := tx.ExecContext(ctx, "ROLLBACK TO SAVEPOINT import_data"); rollbackErr != nil {
				return false, rollbackErr
			}
			jobError = "Import failed; no changes were committed"
			if errors.Is(err, errOlderScrape) {
				jobError = err.Error()
			}
		}
	}
	status := "succeeded"
	if jobError != "" {
		status = "failed"
	}
	if _, err := tx.ExecContext(ctx, `UPDATE ingest_jobs SET status=$2,error=$3,finished_at=now() WHERE id=$1`, id, status, jobError); err != nil {
		return false, err
	}
	if err := tx.Commit(); err != nil {
		return false, err
	}
	if status == "succeeded" {
		invalidateProductCaches()
	}
	fmt.Printf("Import %s: %s\n", id, status)
	return true, nil
}

// Cleanup follows the terminal-state commit. A crash between commit and
// deletion is harmless: the next worker repeats this cleanup.
func (q *ingestQueue) cleanup(ctx context.Context, tx *sql.Tx) error {
	rows, err := tx.QueryContext(ctx, `SELECT id FROM ingest_jobs WHERE status<>'pending' AND NOT archive_removed LIMIT 100`)
	if err != nil {
		return err
	}
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		ids = append(ids, id)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	for _, id := range ids {
		if err := os.Remove(filepath.Join(q.spool, id+".zip")); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE ingest_jobs SET archive_removed=true WHERE id=$1`, id); err != nil {
			return err
		}
	}
	// Also covers an ambiguous commit response: the database may have
	// committed successfully even if the worker lost its connection.
	if len(ids) > 0 {
		invalidateProductCaches()
	}
	return q.cleanupOrphans(ctx, tx)
}

// Only old, unregistered files are eligible. New uploads may still be syncing
// or committing their queue row, so they must never be collected here.
func (q *ingestQueue) cleanupOrphans(ctx context.Context, tx *sql.Tx) error {
	entries, err := os.ReadDir(q.spool)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		id := strings.TrimSuffix(name, ".zip")
		hash, hashErr := hex.DecodeString(id)
		isArchive := strings.HasSuffix(name, ".zip") && hashErr == nil && len(hash) == sha256.Size
		if !strings.HasPrefix(name, ".upload-") && !isArchive {
			continue
		}
		info, err := entry.Info()
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			return err
		}
		if time.Since(info.ModTime()) < 24*time.Hour {
			continue
		}
		if isArchive {
			var registered bool
			if err := tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM ingest_jobs WHERE id=$1)`, id).Scan(&registered); err != nil {
				return err
			}
			if registered {
				continue
			}
		}
		if err := os.Remove(filepath.Join(q.spool, name)); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}
	return nil
}
