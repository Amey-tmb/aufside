import { esc } from '../utils.js';
import { fetchWithTimeout } from '../api.js';
import { skeletonTable } from '../skeletons.js';
import { matchCardsHtml } from '../match-card.js';
import { ToolShell } from '../tool-shell.js';
import { renderRoot } from '../app.js';

/* ---- Live Scores & League Table ---- */
export async function LiveView(){
  renderRoot(ToolShell('Live Scores & League Table','Premier League standings and recent results.', skeletonTable(6)));
  try{
    const {scoreboard, standings} = await fetchWithTimeout('/api/livescores', 10000);
    renderLiveBody(scoreboard, standings);
  }catch(e){
    renderRoot(ToolShell('Live Scores & League Table','Premier League standings and recent results.', `<div class="err-box">Live data is unavailable right now (${esc(e.message)}).</div>`));
  }
}
// Live scores/standings are fetched via api/livescores.py (server-side,
// using a football-data.org key stored as a Vercel env var).
function renderLiveBody(scoreboard, standings){
  const events = (scoreboard.events||[]).slice(0,10);
  const scoresHtml = matchCardsHtml(events);

  let tableHtml = '<div class="empty-box">Standings unavailable.</div>';
  try{
    const entries = standings.children?.[0]?.standings?.entries || standings.standings?.[0]?.entries || [];
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

  const body = `
    <div class="section-label">Recent / live results</div>
    ${scoresHtml}
    <div class="section-label">League table</div>
    ${tableHtml}
  `;
  renderRoot(ToolShell('Live Scores & League Table','Premier League standings and recent results.', body));
}
