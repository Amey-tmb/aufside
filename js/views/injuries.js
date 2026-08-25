import { state } from '../state.js';
import { ensureBootstrap, loadPicksForTeam } from '../api.js';
import { teamOf, posOf, priceFmt, photoUrl, statusBadge, scorePlayer } from '../scoring.js';
import { esc } from '../utils.js';
import { skeletonRows } from '../skeletons.js';
import { ToolShell } from '../tool-shell.js';
import { renderRoot } from '../app.js';

/* ---- Injury Tracker ---- */
export async function InjuriesView(){
  renderRoot(ToolShell('Injury Tracker','Doubts, injuries and suspensions across the league.', skeletonRows(4)));
  try{
    const bs = await ensureBootstrap();
    if(state.teamId && (!state.picks || String(state.picks.entry_history?.entry)!==String(state.teamId))){
      try{ await loadPicksForTeam(state.teamId); }catch(e){}
    }
    renderInjuriesBody(bs);
  }catch(e){
    renderRoot(ToolShell('Injury Tracker','Doubts, injuries and suspensions across the league.', `<div class="err-box">${esc(state.errors.bootstrap || e.message)}</div>`));
  }
}
function renderInjuriesBody(bs){
  const flagged = bs.elements.filter(el=>statusBadge(el)!==null && el.status!=='n')
    .sort((a,b)=>(a.chance_of_playing_next_round??0)-(b.chance_of_playing_next_round??0));
  const squadIds = new Set((state.picks?.picks||[]).map(p=>p.element));
  const fixtures = state.fixtures;

  const body = flagged.length===0 ? `<div class="empty-box">No notable injuries or doubts reported right now.</div>` : `
    <div class="grid grid-2">
      ${flagged.slice(0,40).map(el=>{
        const t = teamOf(bs, el.team);
        const sb = statusBadge(el);
        const inSquad = squadIds.has(el.id);
        let replacement = '';
        if(inSquad && state.picks){
          const byId = Object.fromEntries(bs.elements.map(e=>[e.id,e]));
          const squadElements = state.picks.picks.map(p=>byId[p.element]);
          const squadTeamCounts = {}; squadElements.forEach(e=>squadTeamCounts[e.team]=(squadTeamCounts[e.team]||0)+1);
          const squadIdSet = new Set(squadElements.map(e=>e.id));
          const budget = (state.picks.entry_history?.bank??0) + el.now_cost;
          const cands = bs.elements.filter(c=>c.element_type===el.element_type && !squadIdSet.has(c.id) && c.now_cost<=budget && c.status==='a' && (squadTeamCounts[c.team]||0)<3);
          if(fixtures){
            const best = cands.map(c=>({c,...scorePlayer(c,bs,fixtures)})).sort((a,b)=>b.total-a.total)[0];
            if(best) replacement = `<div class="swap-reason" style="margin-top:10px;">Suggested cover: <b style="color:var(--accent)">${esc(best.c.web_name)}</b> (${priceFmt(best.c.now_cost)})</div>`;
          }
        }
        return `
        <div class="card news-card" style="align-items:flex-start;">
          <img class="news-thumb" style="border-radius:50%;object-fit:cover;" src="${photoUrl(el.code)}" onerror="this.style.display='none'"/>
          <div style="flex:1;">
            <div class="news-title">${esc(el.first_name)} ${esc(el.web_name)} ${inSquad?'<span class="badge badge-ok" style="margin-left:6px;">In your squad</span>':''}</div>
            <div class="news-meta">${esc(t.name)} · <span class="pos-pill pos-${posOf(el)}">${posOf(el)}</span></div>
            <div style="margin-top:8px;"><span class="badge ${sb.cls}">${sb.label}</span></div>
            ${el.news? `<div style="font-size:13px;color:var(--text-dim);margin-top:8px;line-height:1.5;">${esc(el.news)}</div>`:''}
            ${replacement}
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
  renderRoot(ToolShell('Injury Tracker','Doubts, injuries and suspensions across the league.', body));
}
