import { esc } from '../utils.js';
import { fetchWithTimeout } from '../api.js';
import { fetchRSS, NewsCardHtml } from '../news.js';
import { skeletonRows, skeletonCards, skeletonTable } from '../skeletons.js';
import { matchCardsHtml } from '../match-card.js';

export function LandingView(){
  return `
  <div class="landing">
    <svg class="pitch-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
      <line x1="50" y1="0" x2="50" y2="100" stroke="var(--border)" stroke-width="0.15"/>
      <circle cx="50" cy="50" r="12" fill="none" stroke="var(--border)" stroke-width="0.15"/>
      <rect x="0" y="30" width="8" height="40" fill="none" stroke="var(--border)" stroke-width="0.15"/>
      <rect x="92" y="30" width="8" height="40" fill="none" stroke="var(--border)" stroke-width="0.15"/>
    </svg>
    <div class="landing-inner">
      <h1>Auf<span class="hl">side</span></h1>
    </div>
  </div>
  <div class="home-section">
    <div class="section-label">Live scores</div>
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

export async function loadHomeLive(){
  try{
    const {scoreboard, standings} = await fetchWithTimeout('/api/livescores', 10000);
    renderHomeLive(scoreboard);
    renderHomeStandings(standings);
  }catch(e){
    const liveEl = document.getElementById('homeLive');
    if(liveEl) liveEl.innerHTML = `<div class="err-box">Live scores are unavailable right now (${esc(e.message)}).</div>`;
    const stEl = document.getElementById('homeStandings');
    if(stEl) stEl.innerHTML = `<div class="empty-box">Standings unavailable.</div>`;
  }
}
function renderHomeLive(scoreboard){
  const el = document.getElementById('homeLive');
  if(!el) return;
  const events = (scoreboard.events||[]).slice(0,6);
  el.innerHTML = matchCardsHtml(events);
}
function renderHomeStandings(standings){
  const el = document.getElementById('homeStandings');
  if(!el) return;
  let tableHtml = '<div class="empty-box">Standings unavailable.</div>';
  try{
    const entries = (standings.children?.[0]?.standings?.entries || standings.standings?.[0]?.entries || []).slice(0,10);
    if(entries.length){
      tableHtml = `<div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
        <tbody>${entries.map((e,i)=>{
          const stats = Object.fromEntries((e.stats||[]).map(s=>[s.name, s.value]));
          return `<tr>
            <td class="mono">${i+1}</td>
            <td><div class="player-cell"><img class="crest" src="${e.team?.logos?.[0]?.href||''}" onerror="this.style.display='none'"/><span class="pname">${esc(e.team?.shortDisplayName||e.team?.displayName||'')}</span></div></td>
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
