#!/usr/bin/env python3
"""Run DAWG locally with Python 3.9+. Standard library only."""
import argparse
import functools
import http.server
import pathlib
import socket
import threading
import webbrowser

ROOT = pathlib.Path(__file__).resolve().parent / "dist"


class GameHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".mjs": "text/javascript",
                      ".css": "text/css", ".webp": "image/webp",
                      ".woff": "font/woff", ".woff2": "font/woff2", ".json": "application/json", ".glb": "model/gltf-binary"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def list_directory(self, path):
        self.send_error(404, "No directory listing")

    def log_message(self, fmt, *args):
        if args and len(args) > 1 and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)


def make_server(port=8787, lan=False, root=ROOT):
    handler = functools.partial(GameHandler, directory=str(root))
    return http.server.ThreadingHTTPServer(("0.0.0.0" if lan else "127.0.0.1", port), handler)


def main():
    parser = argparse.ArgumentParser(description="Play the DAWG Arcade locally.")
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--lan", action="store_true", help="Allow devices on your local network")
    parser.add_argument("--no-browser", action="store_true", help="Do not open a browser automatically")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535")
    if not (ROOT / "index.html").is_file():
        parser.exit(1, "Game files are missing. Extract the entire ZIP before launching.\n")
    try:
        server = make_server(args.port, args.lan)
    except OSError as exc:
        parser.exit(1, f"Cannot start on port {args.port}: {exc}\nClose another DAWG launcher or use --port 8788.\n")
    url = f"http://localhost:{args.port}/"
    print(f"\nDAWG POCKET ARCADE — LOCAL EDITION\n\nOpen {url}\nKeep this window open while playing. Press Ctrl+C to stop.\n", flush=True)
    if args.lan:
        try:
            addresses = sorted({a[4][0] for a in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)
                                if not a[4][0].startswith("127.")})
        except OSError:
            addresses = []
        print("LAN mode: other devices on your network can open the game.", flush=True)
        for address in addresses:
            print(f"Phone/tablet: http://{address}:{args.port}/", flush=True)
        if not addresses:
            print(f"Use http://YOUR-COMPUTER-LAN-IP:{args.port}/ on your phone.", flush=True)
    if not args.no_browser:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nDAWG Arcade stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
