import { esc } from '../utils.js';
import { fetchWithTimeout } from '../api.js';
import { fetchRSS, NewsCardHtml } from '../news.js';
import { skeletonRows, skeletonCards, skeletonTable } from '../skeletons.js';
import { matchCardsHtml } from '../match-card.js';

// Tracks which gameweek is currently shown on the home page so the prev/next
// arrows can re-fetch without losing place. null = "let the server pick the
// current one" (used on first load).
let currentGw = null;

export function LandingView(){
  return `
  <div class="landing">
    <div class="landing-hero" aria-hidden="true">
      <div class="lh-sky"></div>
      <div class="lh-cloud lh-cloud-1"></div>
      <div class="lh-cloud lh-cloud-2"></div>
      <div class="lh-hills-back"></div>
      <div class="lh-floodlight lh-fl-1"><span class="lh-glow"></span></div>
      <div class="lh-floodlight lh-fl-2"><span class="lh-glow"></span></div>
      <div class="lh-hills-front"></div>
    </div>
    <div class="landing-inner">
      <h1>Auf<span class="hl">side</span></h1>
      <p class="landing-subtitle">Your evening at the ground, every gameweek.</p>
    </div>
  </div>
  <div class="home-section">
    <div class="section-label">Live scores</div>
    <div id="homeGwNav"></div>
    <div id="homeLive">${skeletonCards(4)}</div>
  </div>
  <div class="home-section">
    <div class="section-label">League table</div>
    <div id="homeStandings">${skeletonTable(6)}</div>
  </div>
  <div class="home-section">
    <div class="section-label">Premier League news</div>
    <div id="homeNews">${skeletonRows(5)}</div>
  </div>
  `;
}

export async function loadHomeLive(gw){
  if(gw !== undefined) currentGw = gw;
  const liveEl = document.getElementById('homeLive');
  const stEl = document.getElementById('homeStandings');
  if(liveEl) liveEl.innerHTML = skeletonCards(4);
  if(stEl) stEl.innerHTML = skeletonTable(6);
  try{
    const qs = currentGw ? `?matchday=${currentGw}` : '';
    const {scoreboard, standings} = await fetchWithTimeout('/api/livescores' + qs, 10000);
    currentGw = scoreboard.matchday;
    renderHomeGwNav(scoreboard);
    renderHomeLive(scoreboard);
    renderHomeStandings(standings);
  }catch(e){
    if(liveEl) liveEl.innerHTML = `<div class="err-box">Live scores are unavailable right now (${esc(e.message)}).</div>`;
    if(stEl) stEl.innerHTML = `<div class="empty-box">Standings unavailable.</div>`;
  }
}
function renderHomeGwNav(scoreboard){
  const el = document.getElementById('homeGwNav');
  if(!el) return;
  const gw = scoreboard.matchday;
  const total = scoreboard.totalMatchdays || 38;
  el.innerHTML = `
    <div class="gw-nav">
      <button class="gw-arrow" id="homeGwPrev" ${gw<=1?'disabled':''} aria-label="Previous gameweek">←</button>
      <div class="gw-label">Gameweek ${gw}</div>
      <button class="gw-arrow" id="homeGwNext" ${gw>=total?'disabled':''} aria-label="Next gameweek">→</button>
    </div>`;
  document.getElementById('homeGwPrev')?.addEventListener('click', ()=>{ if(gw>1) loadHomeLive(gw-1); });
  document.getElementById('homeGwNext')?.addEventListener('click', ()=>{ if(gw<total) loadHomeLive(gw+1); });
}
function renderHomeLive(scoreboard){
  const el = document.getElementById('homeLive');
  if(!el) return;
  const events = scoreboard.events || [];
  el.innerHTML = `<div class="matches-scroll">${matchCardsHtml(events)}</div>`;
}
function renderHomeStandings(standings){
  const el = document.getElementById('homeStandings');
  if(!el) return;
  let tableHtml = '<div class="empty-box">Standings unavailable.</div>';
  try{
    const entries = standings.children?.[0]?.standings?.entries || standings.standings?.[0]?.entries || [];
    if(entries.length){
      tableHtml = `<div class="table-wrap table-scroll"><table>
        <thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
        <tbody>${entries.map((e,i)=>{
          const stats = Object.fromEntries((e.stats||[]).map(s=>[s.name, s.value]));
          const id = e.team?.id;
          const nameCell = `<div class="player-cell"><img class="crest" src="${e.team?.logos?.[0]?.href||''}" onerror="this.style.display='none'"/><span class="pname">${esc(e.team?.shortDisplayName||e.team?.displayName||'')}</span></div>`;
          return `<tr>
            <td class="mono">${i+1}</td>
            <td>${id?`<a class="team-link" href="#/team/${id}">${nameCell}</a>`:nameCell}</td>
            <td class="mono">${stats.gamesPlayed??''}</td>
            <td class="mono">${stats.wins??''}</td>
            <td class="mono">${stats.ties??''}</td>
            <td class="mono">${stats.losses??''}</td>
            <td class="mono">${stats.pointDifferential??''}</td>
            <td class="mono" style="font-weight:700;">${stats.points??''}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`;
    }
  }catch(e){}
  el.innerHTML = tableHtml;
}
export async function loadHomeNews(){
  const el = document.getElementById('homeNews');
  try{
    const feed = await fetchRSS('https://feeds.bbci.co.uk/sport/football/rss.xml');
    const plMatch = /premier league|arsenal|man(chester)? (utd|united|city)|chelsea|liverpool|tottenham|spurs|newcastle|aston villa|everton|west ham|brighton|wolves|fulham|brentford|forest|palace|bournemouth|luton|burnley|sheffield united/i;
    const plItems = feed.filter(it=>plMatch.test(it.title));
    const items = (plItems.length? plItems : feed).slice(0,10);
    if(!el) return;
    el.innerHTML = items.length===0 ? `<div class="empty-box">No headlines right now.</div>` : `<div class="grid grid-2">${items.map(it=>NewsCardHtml(it,'⚽')).join('')}</div>`;
  }catch(e){
    if(el) el.innerHTML = `<div class="err-box">Could not load news right now (${esc(e.message)}).</div>`;
  }
}
