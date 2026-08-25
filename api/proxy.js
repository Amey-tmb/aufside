// Server-side proxy for Kickoff.
// The FPL API (and a couple of other sources this app uses) don't send
// CORS headers, so browser fetches fail. Server-to-server requests aren't
// subject to CORS at all, so this Vercel serverless function fetches the
// target URL on the server and hands the JSON back to the browser.
//
// This replaces the old approach of racing several public CORS proxies
// (corsproxy.io, allorigins.win, codetabs), which are unreliable and can
// go down or get rate-limited without warning.

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Missing "url" query parameter' });
    return;
  }

  // Basic allowlist so this endpoint can't be used as an open proxy for
  // arbitrary sites.
  const allowedHosts = [
    'fantasy.premierleague.com',
    'site.api.espn.com',
    'api.rss2json.com',
  ];

  let target;
  try {
    target = new URL(url);
  } catch (e) {
    res.status(400).json({ error: 'Invalid url' });
    return;
  }

  if (!allowedHosts.includes(target.hostname)) {
    res.status(403).json({ error: 'Host not allowed: ' + target.hostname });
    return;
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KickoffApp/1.0; +https://vercel.app)',
        'Accept': 'application/json',
      },
    });

    const text = await upstream.text();

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: 'Upstream returned ' + upstream.status });
      return;
    }

    // Cache at the edge briefly so repeat visits are fast and we don't
    // hammer the upstream APIs.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(text);
  } catch (e) {
    res.status(502).json({ error: 'Proxy fetch failed: ' + (e && e.message ? e.message : String(e)) });
  }
}
