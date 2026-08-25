import { state } from './state.js';

/* -------------------------------- Fetch --------------------------------- */
// FPL's API does not send CORS headers for browser fetches, so we go through
// our own Vercel serverless proxy (which itself now runs on Python).
//
// fetchWithTimeout deliberately avoids AbortController: some embedded/proxied
// browser contexts relay fetch via postMessage, and an AbortSignal can't be
// structured-cloned through postMessage. A plain Promise.race gives the same
// timeout behaviour without touching AbortController at all.
export function fetchWithTimeout(url, ms=7000){
  const timeoutPromise = new Promise((_, reject)=>{
    setTimeout(()=>reject(new Error('timed out')), ms);
  });
  const fetchPromise = fetch(url)
    .then(res=>{ if(!res.ok) throw new Error('HTTP '+res.status); return res.json(); });
  return Promise.race([fetchPromise, timeoutPromise]);
}
export async function fetchJSON(url){
  // Primary path: our own Vercel serverless function (api/proxy.py) fetches
  // server-side, so no CORS issue and no dependency on flaky public proxies.
  try{
    return await fetchWithTimeout('/api/proxy?url=' + encodeURIComponent(url), 10000);
  }catch(e){
    // Fallback: if the serverless function is unreachable for some reason
    // (e.g. running the file locally off-disk instead of via Vercel),
    // fall back to racing public CORS proxies like before.
    const attempts = [
      'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url),
      'https://corsproxy.io/?url=' + encodeURIComponent(url),
      'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
    ];
    try{
      return await Promise.any(attempts.map(a=>fetchWithTimeout(a)));
    }catch(e2){
      throw new Error('all proxies failed');
    }
  }
}

// Simple TTL cache in persistent storage so repeat visits/tool-switches
// don't re-fetch large payloads (bootstrap-static is ~1.6MB) every time.
export async function fetchJSONCached(url, cacheKey, ttlMs){
  try{
    const cached = await window.storage.get(cacheKey);
    if(cached && cached.value){
      const parsed = JSON.parse(cached.value);
      if(Date.now() - parsed.t < ttlMs) return parsed.d;
    }
  }catch(e){ /* no cache yet */ }
  const data = await fetchJSON(url);
  try{ await window.storage.set(cacheKey, JSON.stringify({t:Date.now(), d:data})); }catch(e){}
  return data;
}

export async function ensureBootstrap(){
  if(state.bootstrap) return state.bootstrap;
  state.loadingBootstrap = true;
  try{
    // cached for 15 min — this payload is large and doesn't change fast
    state.bootstrap = await fetchJSONCached('https://fantasy.premierleague.com/api/bootstrap-static/', 'aufside:cache:bootstrap', 15*60*1000);
    return state.bootstrap;
  }catch(e){
    state.errors.bootstrap = 'Could not reach the FPL API right now (' + e.message + '). This is usually a temporary CORS/network hiccup — try again in a moment.';
    throw e;
  }finally{
    state.loadingBootstrap = false;
  }
}

export async function ensureFixtures(){
  if(state.fixtures) return state.fixtures;
  try{
    state.fixtures = await fetchJSONCached('https://fantasy.premierleague.com/api/fixtures/?future=1', 'aufside:cache:fixtures', 15*60*1000);
    return state.fixtures;
  }catch(e){
    state.errors.fixtures = 'Could not load fixtures (' + e.message + ').';
    throw e;
  }
}

export async function loadPicksForTeam(teamId){
  state.loadingPicks = true;
  state.errors.picks = null;
  try{
    const bs = await ensureBootstrap();
    const events = bs.events;
    // prefer the current event; fall back to the most recent finished one, then next
    let ev = events.find(e=>e.is_current) || [...events].reverse().find(e=>e.finished) || events.find(e=>e.is_next) || events[0];
    let picks = null, usedEvent = ev;
    // try current event first, then step backwards until we find picks that exist
    const candidates = [ev, ...events.filter(e=>e.id < ev.id).sort((a,b)=>b.id-a.id).slice(0,3)];
    for(const cand of candidates){
      try{
        picks = await fetchJSON(`https://fantasy.premierleague.com/api/entry/${teamId}/event/${cand.id}/picks/`);
        usedEvent = cand;
        break;
      }catch(e){ continue; }
    }
    if(!picks) throw new Error('No picks found for this team yet');
    state.picks = picks;
    state.picksEvent = usedEvent;
    try{ state.entryInfo = await fetchJSON(`https://fantasy.premierleague.com/api/entry/${teamId}/`); }catch(e){ state.entryInfo = null; }
    return picks;
  }catch(e){
    state.errors.picks = 'Could not load that team. Double-check the Team ID (' + e.message + ').';
    state.picks = null;
    throw e;
  }finally{
    state.loadingPicks = false;
  }
}

export async function ensurePlayerSummary(elementId){
  if(state.playerSummaryCache[elementId]) return state.playerSummaryCache[elementId];
  const data = await fetchJSON(`https://fantasy.premierleague.com/api/element-summary/${elementId}/`);
  state.playerSummaryCache[elementId] = data;
  return data;
}

