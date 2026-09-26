package main

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"image"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func queuedArchive(t *testing.T, output ScraperOutput, photo []byte) []byte {
	t.Helper()
	var buffer bytes.Buffer
	w := zip.NewWriter(&buffer)
	f, err := w.Create("prices.json")
	if err != nil {
		t.Fatal(err)
	}
	if err := json.NewEncoder(f).Encode(output); err != nil {
		t.Fatal(err)
	}
	if photo != nil {
		f, err = w.Create("images/E1.jpg")
		if err != nil {
			t.Fatal(err)
		}
		if _, err := f.Write(photo); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

func queueRouter(q *ingestQueue) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	registerReadRoutes(router)
	q.registerRoutes(router, "test-user", "test-pass")
	return router
}

func submitArchive(t *testing.T, router http.Handler, archive []byte) ingestJob {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel() // The worker must not inherit the now-finished HTTP context.
	req := httptest.NewRequest(http.MethodPost, "/api/ingest/jobs", bytes.NewReader(archive)).WithContext(ctx)
	req.Header.Set("Content-Type", "application/zip")
	req.SetBasicAuth("test-user", "test-pass")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)
	if response.Code != http.StatusAccepted {
		t.Fatalf("submit: %d %s", response.Code, response.Body)
	}
	var job ingestJob
	if err := json.Unmarshal(response.Body.Bytes(), &job); err != nil {
		t.Fatal(err)
	}
	hash := sha256.Sum256(archive)
	if job.ID != hex.EncodeToString(hash[:]) {
		t.Fatal("job not keyed by archive digest")
	}
	return job
}

func TestQueuedImportSurvivesRequestAndQueueRestart(t *testing.T) {
	database := testDatabase(t)
	spool := t.TempDir()
	q, err := newIngestQueue(database, spool)
	if err != nil {
		t.Fatal(err)
	}
	router := queueRouter(q)
	var photo bytes.Buffer
	if err := png.Encode(&photo, image.NewRGBA(image.Rect(0, 0, 20, 20))); err != nil {
		t.Fatal(err)
	}
	output := fixtureWithImage()
	output.Metadata.Market, output.Metadata.Currency = "JP", "JPY"
	output.Products["men/tops"][0].Price = "¥1,990"
	archive := queuedArchive(t, output, photo.Bytes())
	job := submitArchive(t, router, archive)
	if job.Status != "pending" {
		t.Fatal(job)
	}
	duplicate := submitArchive(t, router, archive)
	if duplicate != job {
		t.Fatalf("duplicate created another job: %+v", duplicate)
	}
	var count int
	if err := database.QueryRow("SELECT count(*) FROM products").Scan(&count); err != nil || count != 0 {
		t.Fatalf("submission performed import: %d %v", count, err)
	}

	// Reconstruct the worker from only durable state, after the HTTP context
	// has ended, exactly as a new API process does on startup.
	restarted, err := newIngestQueue(database, spool)
	if err != nil {
		t.Fatal(err)
	}
	if worked, err := restarted.processNext(context.Background()); !worked || err != nil {
		t.Fatalf("process: %v %v", worked, err)
	}
	job, err = restarted.lookup(context.Background(), job.ID)
	if err != nil || job.Status != "succeeded" {
		t.Fatalf("%+v %v", job, err)
	}
	if err := database.QueryRow("SELECT count(*) FROM product_images WHERE market_code='JP'").Scan(&count); err != nil || count != 1 {
		t.Fatalf("Japan image not committed: %d %v", count, err)
	}
	// A later pass removes completed payloads, but keeps status for retries.
	if _, err := restarted.processNext(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(spool, job.ID+".zip")); !os.IsNotExist(err) {
		t.Fatalf("archive not cleaned: %v", err)
	}
	if replay := submitArchive(t, router, archive); replay.Status != "succeeded" {
		t.Fatal(replay)
	}
	if _, err := os.Stat(filepath.Join(spool, job.ID+".zip")); !os.IsNotExist(err) {
		t.Fatal("duplicate recreated completed payload")
	}
	if err := database.QueryRow("SELECT count(*) FROM ingest_jobs").Scan(&count); err != nil || count != 1 {
		t.Fatalf("duplicate job: %d %v", count, err)
	}

	for _, path := range []string{"/api/ingest/jobs", "/api/ingest/jobs/" + job.ID} {
		method := http.MethodGet
		if path == "/api/ingest/jobs" {
			method = http.MethodPost
		}
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(method, path, nil))
		if recorder.Code != http.StatusUnauthorized {
			t.Fatalf("unprotected %s: %d", path, recorder.Code)
		}
	}
	req := httptest.NewRequest(http.MethodGet, "/api/ingest/jobs/"+job.ID, nil)
	req.SetBasicAuth("test-user", "test-pass")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)
	if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte(`"succeeded"`)) {
		t.Fatalf("status route: %s", response.Body)
	}
}

func TestWorkerInterruptionLeavesJobPendingAndExcludesOtherWorkers(t *testing.T) {
	for _, disconnect := range []bool{false, true} {
		t.Run(map[bool]string{false: "process shutdown", true: "database disconnect"}[disconnect], func(t *testing.T) {
			database := testDatabase(t)
			q, err := newIngestQueue(database, t.TempDir())
			if err != nil {
				t.Fatal(err)
			}
			job := submitArchive(t, queueRouter(q), queuedArchive(t, fixture("2026-09-12T03:00:00Z", "CA $ 19.90"), nil))
			// Block the persistence step, giving us a deterministic interruption point.
			blocker, err := database.Begin()
			if err != nil {
				t.Fatal(err)
			}
			defer blocker.Rollback()
			if _, err := blocker.Exec("SELECT pg_advisory_xact_lock(817423)"); err != nil {
				t.Fatal(err)
			}
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			finished := make(chan error, 1)
			go func() { _, err := q.processNext(ctx); finished <- err }()
			deadline := time.Now().Add(5 * time.Second)
			for {
				var waiting bool
				if err := database.QueryRow(`SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid=817423 AND NOT granted)`).Scan(&waiting); err != nil {
					t.Fatal(err)
				}
				if waiting {
					break
				}
				if time.Now().After(deadline) {
					t.Fatal("worker never reached persistence")
				}
				time.Sleep(10 * time.Millisecond)
			}
			if worked, err := q.processNext(context.Background()); worked || err != nil {
				t.Fatalf("competing worker ran: %v %v", worked, err)
			}
			duplicateCtx, duplicateCancel := context.WithTimeout(context.Background(), time.Second)
			defer duplicateCancel()
			if err := q.enqueue(duplicateCtx, job.ID, "unused-for-existing-job"); err != nil {
				t.Fatalf("duplicate submission waited for processing: %v", err)
			}
			if disconnect {
				if _, err := database.Exec(`SELECT pg_terminate_backend(pid) FROM pg_locks WHERE locktype='advisory' AND objid=817423 AND NOT granted`); err != nil {
					t.Fatal(err)
				}
			} else {
				cancel()
			}
			select {
			case err := <-finished:
				if err == nil {
					t.Fatal("interrupted worker succeeded")
				}
			case <-time.After(5 * time.Second):
				t.Fatal("worker ignored shutdown")
			}
			if err := blocker.Rollback(); err != nil {
				t.Fatal(err)
			}
			state, err := q.lookup(context.Background(), job.ID)
			if err != nil || state.Status != "pending" {
				t.Fatalf("lost interrupted job: %+v %v", state, err)
			}
			restarted, err := newIngestQueue(database, q.spool)
			if err != nil {
				t.Fatal(err)
			}
			if worked, err := restarted.processNext(context.Background()); !worked || err != nil {
				t.Fatalf("recovery: %v %v", worked, err)
			}
			state, err = q.lookup(context.Background(), job.ID)
			if err != nil || state.Status != "succeeded" {
				t.Fatalf("recovery state: %+v %v", state, err)
			}
		})
	}
}

func TestQueuedImportFailureRollsBackAndReportsFailure(t *testing.T) {
	for _, invalidPhoto := range []bool{true, false} {
		t.Run(map[bool]string{true: "invalid image", false: "database error"}[invalidPhoto], func(t *testing.T) {
			database := testDatabase(t)
			q, err := newIngestQueue(database, t.TempDir())
			if err != nil {
				t.Fatal(err)
			}
			output := fixture("2026-09-12T03:00:00Z", "CA $ 19.90")
			var photo []byte
			if invalidPhoto {
				output = fixtureWithImage()
				photo = []byte("invalid photo")
			} else {
				// Fail after product writes, proving the savepoint rolls them back
				// while still allowing the terminal job failure to commit.
				_, err := database.Exec(`CREATE FUNCTION reject_scrape() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$;
				CREATE TRIGGER reject_scrape BEFORE INSERT ON scraper FOR EACH ROW EXECUTE FUNCTION reject_scrape()`)
				if err != nil {
					t.Fatal(err)
				}
			}
			job := submitArchive(t, queueRouter(q), queuedArchive(t, output, photo))
			if worked, err := q.processNext(context.Background()); !worked || err != nil {
				t.Fatalf("process: %v %v", worked, err)
			}
			state, err := q.lookup(context.Background(), job.ID)
			if err != nil || state.Status != "failed" || state.Error == "" {
				t.Fatalf("failure not reported: %+v %v", state, err)
			}
			var count int
			if err := database.QueryRow("SELECT count(*) FROM products").Scan(&count); err != nil || count != 0 {
				t.Fatalf("partial import: %d %v", count, err)
			}
		})
	}
}

func TestOrphanCleanupPreservesRegisteredAndRecentUploads(t *testing.T) {
	database := testDatabase(t)
	q, err := newIngestQueue(database, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	job := submitArchive(t, queueRouter(q), queuedArchive(t, fixture("2026-09-12T03:00:00Z", "CA $ 19.90"), nil))
	old := time.Now().Add(-48 * time.Hour)
	registered := filepath.Join(q.spool, job.ID+".zip")
	if err := os.Chtimes(registered, old, old); err != nil {
		t.Fatal(err)
	}
	orphanHash := sha256.Sum256([]byte("orphan"))
	orphan := hex.EncodeToString(orphanHash[:]) + ".zip"
	for _, name := range []string{orphan, ".upload-old", ".upload-active", "unrelated.txt"} {
		path := filepath.Join(q.spool, name)
		if err := os.WriteFile(path, []byte("data"), 0600); err != nil {
			t.Fatal(err)
		}
		if name != ".upload-active" {
			if err := os.Chtimes(path, old, old); err != nil {
				t.Fatal(err)
			}
		}
	}
	tx, err := database.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	if err := q.cleanupOrphans(context.Background(), tx); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{orphan, ".upload-old"} {
		if _, err := os.Stat(filepath.Join(q.spool, name)); !os.IsNotExist(err) {
			t.Fatalf("orphan retained: %s %v", name, err)
		}
	}
	for _, name := range []string{job.ID + ".zip", ".upload-active", "unrelated.txt"} {
		if _, err := os.Stat(filepath.Join(q.spool, name)); err != nil {
			t.Fatalf("live file removed: %s %v", name, err)
		}
	}
}
