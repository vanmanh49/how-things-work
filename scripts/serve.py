"""Local dev server that disables caching, so browser checks never run stale JS/CSS.
Usage: python3 scripts/serve.py [port]   (default 8000)"""
import functools, http.server, pathlib, sys

class NoStore(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
root = pathlib.Path(__file__).resolve().parent.parent
print(f'Serving {root} at http://localhost:{port}/')
http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(NoStore, directory=root)).serve_forever()
