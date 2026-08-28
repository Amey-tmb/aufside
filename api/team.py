import json
import os
import time
import urllib.request
import urllib.error
import urllib.parse
from http.server import BaseHTTPRequestHandler

# Fetches a club's full squad (and, where available on your football-data.org
# plan, the lineup from their most recent match) so clicking a team on the
# Live Scores page can show who plays for them.
#
# Query params:
#   ?id=N   required. football-data.org team ID (passed through from the
#           team objects already returned by /api/livescores).
#
# football-data.org's free tier has a very low per-minute rate limit shared
# across ALL visitors to this app, so 429s are expected under normal use.
# We (a) cache successful responses for much longer so repeat views of the
# same club don't re-hit the upstream API, and (b) retry once with a short
# backoff before giving up on a 429.


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

        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)
        team_id = (params.get('id') or [None])[0]
        if not team_id:
            self._send_json(400, {'error': 'Missing "id" query parameter'})
            return

        headers = {'X-Auth-Token': api_key}

        try:
            team = _fetch_json(f'https://api.football-data.org/v4/teams/{team_id}', headers)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                self._send_json(429, {'error': 'The football data provider is rate-limiting us right now — please wait a minute and try again.'})
            else:
                self._send_json(e.code, {'error': f'football-data.org returned {e.code} for team {team_id}'})
            return
        except Exception as e:
            self._send_json(502, {'error': f'Fetch failed: {e}'})
            return

        squad = [{
            'id': p.get('id'),
            'name': p.get('name'),
            'position': p.get('position'),
            'nationality': p.get('nationality'),
            'dateOfBirth': p.get('dateOfBirth'),
            'shirtNumber': p.get('shirtNumber'),
        } for p in team.get('squad', [])]

        # Best-effort: try to surface the lineup from the team's most recent
        # match. Not every football-data.org plan includes lineup data, so
        # this is wrapped defensively and simply omitted if unavailable.
        lineup = None
        recent_match = None
        try:
            recent = _fetch_json(
                f'https://api.football-data.org/v4/teams/{team_id}/matches?status=FINISHED&limit=1',
                headers,
            )
            matches = recent.get('matches', [])
            if matches:
                match_id = matches[0].get('id')
                detail = _fetch_json(f'https://api.football-data.org/v4/matches/{match_id}', headers)
                home, away = detail.get('homeTeam', {}), detail.get('awayTeam', {})
                is_home = str(home.get('id')) == str(team_id)
                side = home if is_home else away
                opp = away if is_home else home
                side_lineup = side.get('lineup') or []
                if side_lineup:
                    lineup = [{'name': p.get('name'), 'position': p.get('position'), 'shirtNumber': p.get('shirtNumber')} for p in side_lineup]
                    recent_match = {
                        'opponent': opp.get('shortName') or opp.get('name'),
                        'isHome': is_home,
                        'date': detail.get('utcDate'),
                    }
        except Exception:
            lineup = None
            recent_match = None

        self._send_json(200, {
            'team': {
                'id': team.get('id'),
                'name': team.get('name'),
                'shortName': team.get('shortName'),
                'crest': team.get('crest'),
                'venue': team.get('venue'),
                'clubColors': team.get('clubColors'),
                'coach': (team.get('coach') or {}).get('name'),
            },
            'squad': squad,
            'lineup': lineup,
            'recentMatch': recent_match,
        }, cache=True)

    def _send_json(self, status, payload, cache=False):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        if cache:
            self.send_header('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
