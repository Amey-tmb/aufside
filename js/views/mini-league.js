import { state } from '../state.js';
import { saveLeagueId } from '../storage.js';
import { fetchJSON } from '../api.js';
import { esc } from '../utils.js';
import { skeletonTable } from '../skeletons.js';
import { ToolShell } from '../tool-shell.js';
import { renderRoot } from '../app.js';

/* ---- Mini-League ---- */
function NeedLeaguePrompt(){
  return `
    <div class="card" style="text-align:center;padding:40px 20px;">
      <div style="font-size:28px;margin-bottom:10px;">🏆</div>
      <div style="font-weight:600;margin-bottom:6px;">No league loaded yet</div>
      <div style="color:var(--text-dim);font-size:13.5px;margin-bottom:18px;">Enter your classic mini-league ID — find it in the URL when you view your league on the official FPL site.</div>
      <form id="inlineLeagueForm" style="display:flex;gap:8px;max-width:360px;margin:0 auto;">
        <input type="text" inputmode="numeric" id="inlineLeagueInput" placeholder="League ID" style="flex:1;background:var(--surface-2);border:1px solid var(--border);border-radius:9px;padding:10px 12px;color:var(--text);outline:none;">
        <button type="submit" style="background:var(--accent);color:#04140D;border:none;border-radius:9px;padding:0 16px;font-weight:700;">Load</button>
      </form>
    </div>`;
}
function wireInlineLeagueForm(){
  const f = document.getElementById('inlineLeagueForm');
  if(!f) return;
  f.addEventListener('submit', e=>{
    e.preventDefault();
    const v = document.getElementById('inlineLeagueInput').value.trim();
    if(!v) return;
    state.leagueId = v; saveLeagueId(v);
    MiniLeagueView();
  });
}
export async function MiniLeagueView(){
  if(!state.leagueId){
    renderRoot(ToolShell('Mini-League','Live standings for your private FPL league.', NeedLeaguePrompt()));
    wireInlineLeagueForm();
    return;
  }
  renderRoot(ToolShell('Mini-League','Live standings for your private FPL league.', skeletonTable(8)));
  try{
    const data = await fetchJSON(`https://fantasy.premierleague.com/api/leagues-classic/${encodeURIComponent(state.leagueId)}/standings/`);
    renderMiniLeagueBody(data);
  }catch(e){
    renderRoot(ToolShell('Mini-League','Live standings for your private FPL league.', `<div class="err-box">Couldn't load that league (${esc(e.message)}). Double check the League ID.</div>${NeedLeaguePrompt()}`));
    wireInlineLeagueForm();
  }
}
function renderMiniLeagueBody(data){
  const league = data.league || {};
  const results = (data.standings && data.standings.results) || [];
  const rows = results.map(r=>{
    const moved = (r.last_rank||0) - r.rank;
    const moveIcon = moved>0 ? '▲' : moved<0 ? '▼' : '—';
    const moveColor = moved>0 ? 'var(--accent)' : moved<0 ? 'var(--bad)' : 'var(--text-dim)';
    const isYou = state.entryInfo && String(r.entry)===String(state.entryInfo.id);
    return `<tr${isYou?` style="background:var(--accent-dim);"`:''}>
      <td class="mono">${r.rank}</td>
      <td class="mono" style="color:${moveColor};font-size:12px;">${moveIcon}</td>
      <td><div class="pname">${esc(r.entry_name)}</div><div class="psub">${esc(r.player_name)}</div></td>
      <td class="mono">${r.event_total??''}</td>
      <td class="mono" style="font-weight:700;">${r.total}</td>
    </tr>`;
  }).join('');
  const body = results.length===0 ? `<div class="empty-box">No standings found for this league.</div>` : `
    <div class="section-label">${esc(league.name||'League')}</div>
    <div class="table-wrap"><table>
      <thead><tr><th>#</th><th></th><th>Team</th><th>GW</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div style="margin-top:16px;"><a href="#" id="changeLeagueLink" style="font-size:12.5px;color:var(--text-dim);font-weight:600;">Change league →</a></div>
  `;
  renderRoot(ToolShell('Mini-League','Live standings for your private FPL league.', body));
  const link = document.getElementById('changeLeagueLink');
  if(link) link.addEventListener('click', (e)=>{ e.preventDefault(); state.leagueId=null; MiniLeagueView(); });
}
