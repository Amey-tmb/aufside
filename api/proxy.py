import json
import urllib.request
import urllib.parse
import urllib.error
from http.server import BaseHTTPRequestHandler

# Server-side proxy for Aufside.
# The FPL API (and a couple of other sources this app uses) don't send
# CORS headers, so browser fetches fail. Server-to-server requests aren't
# subject to CORS at all, so this Vercel serverless function fetches the
# target URL on the server and hands the JSON back to the browser.
#
# This replaces the old approach of racing several public CORS proxies
# (corsproxy.io, allorigins.win, codetabs), which are unreliable and can
# go down or get rate-limited without warning.

# Basic allowlist so this endpoint can't be used as an open proxy for
# arbitrary sites.
ALLOWED_HOSTS = {
    'fantasy.premierleague.com',
    'site.api.espn.com',
    'api.rss2json.com',
}


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)
        url = (params.get('url') or [None])[0]

        if not url:
            self._send_json(400, {'error': 'Missing "url" query parameter'})
            return

        try:
            target = urllib.parse.urlparse(url)
        except Exception:
            self._send_json(400, {'error': 'Invalid url'})
            return

        if not target.hostname or target.hostname not in ALLOWED_HOSTS:
            self._send_json(403, {'error': f'Host not allowed: {target.hostname}'})
            return

        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; AufsideApp/1.0; +https://vercel.app)',
            'Accept': 'application/json',
        })

        try:
            with urllib.request.urlopen(req, timeout=10) as upstream:
                body = upstream.read()
                self._send_raw(upstream.status, body, cache=True)
        except urllib.error.HTTPError as e:
            self._send_json(e.code, {'error': f'Upstream returned {e.code}'})
        except Exception as e:
            self._send_json(502, {'error': f'Proxy fetch failed: {e}'})

    def _send_json(self, status, payload):
        self._send_raw(status, json.dumps(payload).encode('utf-8'))

    def _send_raw(self, status, body, cache=False):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        if cache:
            self.send_header('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
