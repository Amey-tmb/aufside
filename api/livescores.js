// Fetches Premier League standings + recent/upcoming matches from
// football-data.org, using an API key stored as a Vercel environment
// variable (never exposed to the browser). This replaces ESPN's
// undocumented API, which frequently blocks requests coming from
// server/datacenter IPs like Vercel's.
//
// Requires an environment variable FOOTBALL_DATA_API_KEY to be set in
// your Vercel project (Settings -> Environment Variables). Get a free
// key at https://www.football-data.org/client/register

export default async function handler(req, res) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) {
    res.status(500).json({ error: 'FOOTBALL_DATA_API_KEY is not configured on the server' });
    return;
  }

  const headers = { 'X-Auth-Token': apiKey };

  // Recent + upcoming matches: a small window around today so we're not
  // pulling the whole season.
  const today = new Date();
  const dateFrom = new Date(today);
  dateFrom.setDate(dateFrom.getDate() - 3);
  const dateTo = new Date(today);
  dateTo.setDate(dateTo.getDate() + 3);
  const fmt = (d) => d.toISOString().slice(0, 10);

  try {
    const [matchesRes, standingsRes] = await Promise.all([
      fetch(`https://api.football-data.org/v4/competitions/PL/matches?dateFrom=${fmt(dateFrom)}&dateTo=${fmt(dateTo)}`, { headers }),
      fetch('https://api.football-data.org/v4/competitions/PL/standings', { headers }),
    ]);

    if (!matchesRes.ok || !standingsRes.ok) {
      const status = !matchesRes.ok ? matchesRes.status : standingsRes.status;
      res.status(status).json({ error: 'football-data.org returned ' + status + ' (check your API key)' });
      return;
    }

    const matchesData = await matchesRes.json();
    const standingsData = await standingsRes.json();

    // Reshape into the ESPN-like shape the frontend's renderLiveBody()
    // already knows how to render, so no frontend changes are needed
    // beyond swapping which endpoint we call.
    const events = (matchesData.matches || []).map(m => ({
      competitions: [{
        competitors: [
          { team: { shortDisplayName: m.homeTeam.shortName || m.homeTeam.name, logo: m.homeTeam.crest }, score: m.score?.fullTime?.home ?? '-' },
          { team: { shortDisplayName: m.awayTeam.shortName || m.awayTeam.name, logo: m.awayTeam.crest }, score: m.score?.fullTime?.away ?? '-' },
        ],
        status: { type: { description: m.status } },
      }],
    }));

    const table = (standingsData.standings?.[0]?.table || []);
    const entries = table.map(row => ({
      team: { shortDisplayName: row.team.shortName || row.team.name, logos: [{ href: row.team.crest }] },
      stats: [
        { name: 'gamesPlayed', value: row.playedGames },
        { name: 'wins', value: row.won },
        { name: 'ties', value: row.draw },
        { name: 'losses', value: row.lost },
        { name: 'pointDifferential', value: row.goalDifference },
        { name: 'points', value: row.points },
      ],
    }));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json({
      scoreboard: { events },
      standings: { standings: [{ entries }] },
    });
  } catch (e) {
    res.status(502).json({ error: 'Fetch failed: ' + (e && e.message ? e.message : String(e)) });
  }
}
