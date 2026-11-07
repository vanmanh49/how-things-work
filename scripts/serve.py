"""Local dev server that disables caching, so browser checks never run stale JS/CSS.
Usage: python3 scripts/serve.py [port]   (default 8000). The site is at / and also at /how-things-work/."""
import functools, http.server, pathlib, sys

class NoStore(http.server.SimpleHTTPRequestHandler):
    # Also serve the site under /how-things-work/, the GitHub Pages sub-path, to test relative links.
    def translate_path(self, path):
        if path == '/how-things-work' or path.startswith('/how-things-work/'):
            path = path[len('/how-things-work'):] or '/'
        return super().translate_path(path)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
root = pathlib.Path(__file__).resolve().parent.parent
print(f'Serving {root} at http://localhost:{port}/')
class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 128   # the default of 5 drops connections when a browser fetches ~20 modules at once

Server(('127.0.0.1', port), functools.partial(NoStore, directory=root)).serve_forever()
