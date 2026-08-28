import json
import os
import time
import urllib.request
import urllib.error
import urllib.parse
from http.server import BaseHTTPRequestHandler

# Fetches Premier League standings + matches for a given gameweek (matchday)
# from football-data.org, using an API key stored as a Vercel environment
# variable (never exposed to the browser).
#
# Requires an environment variable FOOTBALL_DATA_API_KEY to be set in
# your Vercel project (Settings -> Environment Variables). Get a free
# key at https://www.football-data.org/client/register
#
# Query params:
#   ?matchday=N   optional. Defaults to the Premier League's current matchday.
#
# football-data.org's free tier has a very low per-minute rate limit shared
# across ALL visitors to this app. This is the homepage widget, so it's the
# most-hit endpoint — we retry once on a 429 and cache aggressively so a
# burst of visits only needs one upstream round trip.

# The Premier League is a fixed 20-club league, so it always plays exactly
# 38 matchdays a season. Used to clamp/bound the gameweek prev/next arrows
# on the frontend without an extra API call.
TOTAL_MATCHDAYS = 38

# Maps football-data.org's raw match status to an ESPN-like {state, description}
# pair, since the frontend's "live" pulse indicator checks state === 'in'.
STATUS_MAP = {
    'SCHEDULED': ('pre', 'Scheduled'),
    'TIMED': ('pre', 'Scheduled'),
    'IN_PLAY': ('in', 'Live'),
    'PAUSED': ('in', 'Half Time'),
    'FINISHED': ('post', 'Full Time'),
    'POSTPONED': ('post', 'Postponed'),
    'SUSPENDED': ('post', 'Suspended'),
    'CANCELLED': ('post', 'Cancelled'),
}


def _fetch_json(url, headers, retry_on_429=True):
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        if e.code == 429 and retry_on_429:
            time.sleep(1.5)
            return _fetch_json(url, headers, retry_on_429=False)
        raise


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        api_key = os.environ.get('FOOTBALL_DATA_API_KEY')
        if not api_key:
            self._send_json(500, {'error': 'FOOTBALL_DATA_API_KEY is not configured on the server'})
            return

        headers = {'X-Auth-Token': api_key}
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)
        requested_matchday = (params.get('matchday') or [None])[0]

        try:
            matchday = int(requested_matchday) if requested_matchday else None
        except ValueError:
            matchday = None

        try:
            if matchday is None:
                comp = _fetch_json('https://api.football-data.org/v4/competitions/PL', headers)
                matchday = comp.get('currentSeason', {}).get('currentMatchday') or 1
            matchday = max(1, min(TOTAL_MATCHDAYS, matchday))

            matches_data = _fetch_json(
                f'https://api.football-data.org/v4/competitions/PL/matches?matchday={matchday}',
                headers,
            )
            standings_data = _fetch_json(
                'https://api.football-data.org/v4/competitions/PL/standings',
                headers,
            )
        except urllib.error.HTTPError as e:
            if e.code == 429:
                self._send_json(429, {'error': 'The football data provider is rate-limiting us right now — please wait a minute and try again.'})
            else:
                self._send_json(e.code, {'error': f'football-data.org returned {e.code} (check your API key)'})
            return
        except Exception as e:
            self._send_json(502, {'error': f'Fetch failed: {e}'})
            return

        events = []
        for m in matches_data.get('matches', []):
            home, away = m.get('homeTeam', {}), m.get('awayTeam', {})
            score = (m.get('score') or {}).get('fullTime') or {}
            state, desc = STATUS_MAP.get(m.get('status'), ('post', m.get('status', '')))
            events.append({
                'competitions': [{
                    'competitors': [
                        {
                            'team': {'id': home.get('id'), 'shortDisplayName': home.get('shortName') or home.get('name'), 'logo': home.get('crest')},
                            'score': score.get('home') if score.get('home') is not None else '-',
                        },
                        {
                            'team': {'id': away.get('id'), 'shortDisplayName': away.get('shortName') or away.get('name'), 'logo': away.get('crest')},
                            'score': score.get('away') if score.get('away') is not None else '-',
                        },
                    ],
                    'status': {'type': {'state': state, 'description': desc}},
                }],
            })

        table = ((standings_data.get('standings') or [{}])[0]).get('table', [])
        entries = []
        for row in table:
            team = row.get('team', {})
            entries.append({
                'team': {'id': team.get('id'), 'shortDisplayName': team.get('shortName') or team.get('name'), 'logos': [{'href': team.get('crest')}]},
                'stats': [
                    {'name': 'gamesPlayed', 'value': row.get('playedGames')},
                    {'name': 'wins', 'value': row.get('won')},
                    {'name': 'ties', 'value': row.get('draw')},
                    {'name': 'losses', 'value': row.get('lost')},
                    {'name': 'pointDifferential', 'value': row.get('goalDifference')},
                    {'name': 'points', 'value': row.get('points')},
                ],
            })

        self._send_json(200, {
            'scoreboard': {'events': events, 'matchday': matchday, 'totalMatchdays': TOTAL_MATCHDAYS},
            'standings': {'standings': [{'entries': entries}]},
        }, cache=True)

    def _send_json(self, status, payload, cache=False):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        if cache:
            self.send_header('Cache-Control', 's-maxage=120, stale-while-revalidate=600')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
