"""Submit a durable import and wait for its committed result (standard library only)."""

import argparse
import base64
import hashlib
import http.client
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def request(url, authorization, archive=None):
    headers = {"Authorization": authorization, "Accept": "application/json"}
    opener = urllib.request.build_opener(NoRedirect)
    if archive is None:
        with opener.open(urllib.request.Request(url, headers=headers), timeout=30) as response:
            return json.load(response)
    headers.update({"Content-Type": "application/zip", "Content-Length": str(archive.stat().st_size)})
    # http.client streams the file object, without copying the archive into RAM.
    with archive.open("rb") as payload:
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        with opener.open(req, timeout=240) as response:
            return json.load(response)


def wait_for_import(archive, api_url, user, password, timeout=2700, interval=10):
    digest = hashlib.sha256()
    with archive.open("rb") as payload:
        for chunk in iter(lambda: payload.read(1024 * 1024), b""):
            digest.update(chunk)
    job_id = digest.hexdigest()
    authorization = "Basic " + base64.b64encode(f"{user}:{password}".encode()).decode()
    endpoint = api_url.rstrip("/") + "/api/ingest/jobs"
    status_url = endpoint + "/" + job_id
    deadline = time.monotonic() + timeout
    print(f"Import job: {job_id}", flush=True)
    last_status = None
    while time.monotonic() < deadline:
        try:
            # Check first, including after ambiguous upload failures. Retrying
            # never creates a second job or re-uploads an accepted archive.
            try:
                job = request(status_url, authorization)
            except urllib.error.HTTPError as error:
                if error.code != 404:
                    raise
                job = request(endpoint, authorization, archive)
            if job.get("id") != job_id:
                raise RuntimeError("API returned an unexpected import job ID")
            status = job.get("status")
            if status != last_status:
                print(f"Import status: {status}", flush=True)
                last_status = status
            if status == "succeeded":
                return job
            if status == "failed":
                raise RuntimeError(job.get("error") or "Import failed")
            if status != "pending":
                raise RuntimeError(f"Unknown import status: {status}")
        except urllib.error.HTTPError as error:
            if error.code != 429 and error.code < 500:
                raise RuntimeError(f"Import API returned HTTP {error.code}") from error
            print(f"Import API temporarily unavailable (HTTP {error.code}); retrying", flush=True)
        except (urllib.error.URLError, TimeoutError, ConnectionError, http.client.HTTPException, json.JSONDecodeError):
            print("Import connection interrupted; checking the same job again", flush=True)
        time.sleep(min(interval, max(0, deadline - time.monotonic())))
    raise RuntimeError(f"Timed out waiting for import {job_id}; it may still be pending. Check {status_url}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    args = parser.parse_args()
    try:
        wait_for_import(args.archive, os.getenv("API_URL", "https://api.uniqlotracker.com"),
                        os.environ["AUTH_USER"], os.environ["AUTH_PASS"])
    except (RuntimeError, OSError, KeyError, ValueError) as error:
        parser.exit(1, f"Import failed: {error}\n")


if __name__ == "__main__":
    main()
