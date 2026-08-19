#!/usr/bin/env python3
"""
A local drop box for authored SVG replies.

ORD-43. The chat replies are 6-10 kB of SVG each. Reading them back through
the agent's own context to retype them into a file is slow, lossy and
expensive for what is really a copy. This accepts a POST from the page and
writes it straight to disk, so the drawings go browser -> file without a
detour.

Bound to 127.0.0.1 and it writes exactly one place: nothing here is
reachable from off the machine.

    python3 scripts/artwork-catcher.py            # serves on 8778
"""

from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

DROP = Path(__file__).resolve().parent.parent / "ios/App/App/Native/Artwork/_inbox"


class Catcher(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("content-length", 0))
        body = self.rfile.read(length).decode("utf-8", "replace")
        name = self.path.strip("/").replace("/", "_") or "reply"
        DROP.mkdir(parents=True, exist_ok=True)
        (DROP / f"{name}.txt").write_text(body)
        self.send_response(200)
        self._cors()
        self.end_headers()
        self.wfile.write(f"saved {len(body)} bytes to {name}.txt".encode())

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print(f"catching into {DROP}")
    HTTPServer(("127.0.0.1", 8778), Catcher).serve_forever()
