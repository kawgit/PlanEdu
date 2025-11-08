# api/hello.py
import time
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        # IMPORTANT: don't set Content-Length → lets Vercel stream chunks
        self.end_headers()

        for i in range(5):
            self.wfile.write(f"Hello, world! {i+1}\n".encode("utf-8"))
            try:
                self.wfile.flush()  # push the chunk right away
            except Exception:
                pass
            time.sleep(2)  # wait a couple seconds between chunks
