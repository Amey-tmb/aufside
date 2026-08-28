import { esc } from '../utils.js';
import { fetchWithTimeout } from '../api.js';
import { skeletonTable } from '../skeletons.js';
import { matchCardsHtml } from '../match-card.js';
import { ToolShell } from '../tool-shell.js';
import { renderRoot } from '../app.js';

const TITLE = 'Live Scores & League Table';
const DESC = 'Premier League standings and results, by gameweek.';

// Tracks which gameweek is currently shown so the prev/next arrows can
// re-fetch without losing place. null = "let the server pick the current one".
let currentGw = null;

/* ---- Live Scores & League Table ---- */
export async function LiveView(gw){
  if(gw !== undefined) currentGw = gw;
  renderRoot(ToolShell(TITLE, DESC, skeletonTable(6)));
  try{
    const qs = currentGw ? `?matchday=${currentGw}` : '';
    const {scoreboard, standings} = await fetchWithTimeout('/api/livescores' + qs, 10000);
    currentGw = scoreboard.matchday;
    renderLiveBody(scoreboard, standings);
  }catch(e){
    const isRateLimited = /429/.test(e.message);
    const msg = isRateLimited
      ? 'The football data provider is getting a lot of requests right now. Give it a minute and try again.'
      : `Live data is unavailable right now (${esc(e.message)}).`;
    renderRoot(ToolShell(TITLE, DESC, `<div class="err-box">${msg}</div>`));
  }
}
// Live scores/standings are fetched via api/livescores.py (server-side,
// using a football-data.org key stored as a Vercel env var).
function renderLiveBody(scoreboard, standings){
  const events = scoreboard.events || [];
  const gw = scoreboard.matchday;
  const total = scoreboard.totalMatchdays || 38;
  const scoresHtml = matchCardsHtml(events);

  const gwNav = `
    <div class="gw-nav">
      <button class="gw-arrow" id="gwPrev" ${gw<=1?'disabled':''} aria-label="Previous gameweek">←</button>
      <div class="gw-label">Gameweek ${gw}</div>
      <button class="gw-arrow" id="gwNext" ${gw>=total?'disabled':''} aria-label="Next gameweek">→</button>
    </div>`;

  let tableHtml = '<div class="empty-box">Standings unavailable.</div>';
  try{
    const entries = standings.children?.[0]?.standings?.entries || standings.standings?.[0]?.entries || [];
    if(entries.length){
      tableHtml = `<div class="table-wrap table-scroll"><table>
        <thead><tr><th>#</th><th>Club</th><th>Form</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
        <tbody>${entries.map((e,i)=>{
          const stats = Object.fromEntries((e.stats||[]).map(s=>[s.name, s.value]));
          const id = e.team?.id;
          const nameCell = `<div class="player-cell"><img class="crest" src="${e.team?.logos?.[0]?.href||''}" onerror="this.style.display='none'"/><span class="pname">${esc(e.team?.shortDisplayName||e.team?.displayName||'')}</span></div>`;
          const form = e.form || [];
          const formHtml = form.length
            ? `<div class="form-strip">${form.slice(-5).map(r=>`<span class="form-pill form-${r}">${esc(r)}</span>`).join('')}</div>`
            : '<span class="text-dim mono" style="font-size:12px;">—</span>';
          return `<tr>
            <td class="mono">${i+1}</td>
            <td>${id?`<a class="team-link" href="#/team/${id}">${nameCell}</a>`:nameCell}</td>
            <td>${formHtml}</td>
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

  const body = `
    ${gwNav}
    <div class="matches-scroll">${scoresHtml}</div>
    <div class="section-label">League table</div>
    ${tableHtml}
  `;
  renderRoot(ToolShell(TITLE, DESC, body));

  document.getElementById('gwPrev')?.addEventListener('click', ()=>{ if(gw>1) LiveView(gw-1); });
  document.getElementById('gwNext')?.addEventListener('click', ()=>{ if(gw<total) LiveView(gw+1); });
}
