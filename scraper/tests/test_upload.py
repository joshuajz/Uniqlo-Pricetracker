import hashlib
import io
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import upload


def http_error(code):
    return urllib.error.HTTPError("http://localhost/jobs", code, "test", {}, io.BytesIO())


class UploadTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.archive = Path(self.directory.name) / "output.zip"
        self.archive.write_bytes(b"archive bytes")
        self.job_id = hashlib.sha256(self.archive.read_bytes()).hexdigest()

    def job(self, status, **extra):
        return {"id": self.job_id, "status": status, **extra}

    def run_import(self):
        return upload.wait_for_import(self.archive, "http://localhost", "user", "pass", interval=0)

    def test_lost_upload_acknowledgement_resumes_without_reupload(self):
        with patch.object(upload, "request", side_effect=[
            http_error(404), urllib.error.URLError("connection lost"),
            self.job("pending"), http_error(503), self.job("succeeded"),
        ]) as request:
            self.assertEqual(self.run_import()["status"], "succeeded")
        self.assertEqual(sum(len(call.args) == 3 for call in request.call_args_list), 1)

    def test_restart_client_uses_existing_terminal_job(self):
        with patch.object(upload, "request", return_value=self.job("succeeded")) as request:
            self.run_import()
        self.assertEqual(request.call_count, 1)
        self.assertEqual(len(request.call_args.args), 2)

    def test_failure_is_not_reported_as_success(self):
        with patch.object(upload, "request", return_value=self.job("failed", error="Invalid image")):
            with self.assertRaisesRegex(RuntimeError, "Invalid image"):
                self.run_import()

    def test_authentication_error_is_not_retried(self):
        with patch.object(upload, "request", side_effect=http_error(401)) as request:
            with self.assertRaisesRegex(RuntimeError, "HTTP 401"):
                self.run_import()
        self.assertEqual(request.call_count, 1)

    def test_timeout_does_not_claim_job_was_canceled(self):
        with patch.object(upload.time, "monotonic", side_effect=[0, 0, 2701, 2701]):
            with patch.object(upload, "request", return_value=self.job("pending")):
                with self.assertRaisesRegex(RuntimeError, "may still be pending"):
                    self.run_import()

    def test_streamed_upload_and_poll_over_http(self):
        # Exercise the actual urllib file streaming and HTTP contract, without
        # allocating a second full copy of the archive in the upload client.
        received = []
        job_id = self.job_id

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                if not received:
                    self.send_error(404)
                else:
                    self.reply("succeeded", 200)

            def do_POST(self):
                received.append((self.rfile.read(int(self.headers["Content-Length"])),
                                 self.headers["Content-Type"], self.headers["Authorization"]))
                self.reply("pending", 202)

            def reply(self, status, code):
                body = json.dumps({"id": job_id, "status": status}).encode()
                self.send_response(code)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        worker = threading.Thread(target=server.serve_forever)
        worker.start()
        try:
            result = upload.wait_for_import(self.archive, f"http://127.0.0.1:{server.server_port}",
                                            "user", "pass", interval=0)
            self.assertEqual(result["status"], "succeeded")
            self.assertEqual(received, [(b"archive bytes", "application/zip", "Basic dXNlcjpwYXNz")])
        finally:
            server.shutdown()
            server.server_close()
            worker.join()
