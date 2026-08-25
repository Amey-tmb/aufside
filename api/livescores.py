import json
import os
import urllib.request
import urllib.error
from datetime import date, timedelta
from http.server import BaseHTTPRequestHandler

# Fetches Premier League standings + recent/upcoming matches from
# football-data.org, using an API key stored as a Vercel environment
# variable (never exposed to the browser). This replaces ESPN's
# undocumented API, which frequently blocks requests coming from
# server/datacenter IPs like Vercel's.
#
# Requires an environment variable FOOTBALL_DATA_API_KEY to be set in
# your Vercel project (Settings -> Environment Variables). Get a free
# key at https://www.football-data.org/client/register

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


def _fetch_json(url, headers):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode('utf-8'))


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        api_key = os.environ.get('FOOTBALL_DATA_API_KEY')
        if not api_key:
            self._send_json(500, {'error': 'FOOTBALL_DATA_API_KEY is not configured on the server'})
            return

        headers = {'X-Auth-Token': api_key}
        today = date.today()
        date_from = (today - timedelta(days=3)).isoformat()
        date_to = (today + timedelta(days=3)).isoformat()

        try:
            matches_data = _fetch_json(
                f'https://api.football-data.org/v4/competitions/PL/matches?dateFrom={date_from}&dateTo={date_to}',
                headers,
            )
            standings_data = _fetch_json(
                'https://api.football-data.org/v4/competitions/PL/standings',
                headers,
            )
        except urllib.error.HTTPError as e:
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
                            'team': {'shortDisplayName': home.get('shortName') or home.get('name'), 'logo': home.get('crest')},
                            'score': score.get('home') if score.get('home') is not None else '-',
                        },
                        {
                            'team': {'shortDisplayName': away.get('shortName') or away.get('name'), 'logo': away.get('crest')},
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
                'team': {'shortDisplayName': team.get('shortName') or team.get('name'), 'logos': [{'href': team.get('crest')}]},
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
            'scoreboard': {'events': events},
            'standings': {'standings': [{'entries': entries}]},
        }, cache=True)

    def _send_json(self, status, payload, cache=False):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        if cache:
            self.send_header('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
