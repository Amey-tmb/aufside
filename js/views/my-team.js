import { state } from '../state.js';
import { POS_SHORT } from '../constants.js';
import { ensureBootstrap, loadPicksForTeam } from '../api.js';
import { teamOf, crestUrl, kitUrl, priceFmt, statusBadge } from '../scoring.js';
import { esc } from '../utils.js';
import { skeletonCards } from '../skeletons.js';
import { ToolShell, NeedTeamPrompt, wireInlineTeamForm } from '../tool-shell.js';
import { renderRoot } from '../app.js';

const TITLE = 'My Team';
const DESC = 'Your imported squad for this gameweek.';

// Remembers which view the user last chose so it persists across re-renders
// within the session (not just for this one call).
let currentView = 'pitch'; // 'pitch' | 'list'

/* ---- My Team ---- */
export async function MyTeamView(){
  if(!state.teamId){
    renderRoot(ToolShell(TITLE, DESC, NeedTeamPrompt('My Team')));
    wireInlineTeamForm(MyTeamView);
    return;
  }
  const root = document.getElementById('root');
  root.innerHTML = ToolShell(TITLE, DESC, skeletonCards(4));
  try{
    await ensureBootstrap();
    await loadPicksForTeam(state.teamId);
  }catch(e){}
  renderMyTeamBody();
}

function viewToggleHtml(){
  return `
    <div class="seg-toggle" role="tablist" aria-label="View mode">
      <button class="seg-btn ${currentView==='pitch'?'is-active':''}" data-view="pitch" type="button">⚽ Pitch</button>
      <button class="seg-btn ${currentView==='list'?'is-active':''}" data-view="list" type="button">☰ List</button>
    </div>`;
}

function wireViewToggle(){
  document.querySelectorAll('.seg-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      currentView = btn.dataset.view;
      renderMyTeamBody();
    });
  });
}

function renderMyTeamBody(){
  const bs = state.bootstrap;
  let body;
  if(state.errors.picks){
    body = `<div class="err-box">${esc(state.errors.picks)}</div>`;
  }else if(!state.picks){
    body = skeletonCards(4);
  }else{
    const byId = Object.fromEntries(bs.elements.map(e=>[e.id,e]));
    const picks = state.picks.picks.map(p=>({...p, el: byId[p.element]}));
    const groups = [1,2,3,4].map(pt=>({
      pos: POS_SHORT[pt],
      players: picks.filter(p=>p.el.element_type===pt).sort((a,b)=>a.position-b.position)
    }));
    const info = state.entryInfo;
    const eh = state.picks.entry_history || {};

    const headerHtml = `
      <div class="grid grid-3" style="margin-bottom:22px;">
        <div class="card stat-tile"><div class="v mono">${eh.points ?? '—'}</div><div class="l">Points — GW${state.picksEvent?.id ?? ''}</div></div>
        <div class="card stat-tile"><div class="v mono">£${eh.value? (eh.value/10).toFixed(1):'—'}m</div><div class="l">Squad value</div></div>
        <div class="card stat-tile"><div class="v mono">£${eh.bank!==undefined? (eh.bank/10).toFixed(1):'—'}m</div><div class="l">In the bank</div></div>
      </div>
      ${info? `<div style="color:var(--text-dim);font-size:13px;margin-bottom:18px;">Managing <b style="color:var(--text)">${esc(info.name||'')}</b> — ${esc(info.player_first_name||'')} ${esc(info.player_last_name||'')}</div>` : ''}
      <div style="margin-bottom:18px;">${viewToggleHtml()}</div>
    `;

    body = headerHtml + (currentView==='pitch' ? pitchViewHtml(groups, bs) : listViewHtml(groups, bs));
  }
  document.getElementById('root').innerHTML = ToolShell(TITLE, DESC, body);
  wireViewToggle();
}

/* ---------------------------- List (table) view --------------------------- */
function listViewHtml(groups, bs){
  return groups.map(g=>`
    <div class="section-label">${g.pos}</div>
    <div class="table-wrap" style="margin-bottom:16px;">
      <table class="roster-table">
        <thead><tr><th>Player</th><th>Price</th><th>Form</th><th>Next GW proj.</th><th>Role</th></tr></thead>
        <tbody>
          ${g.players.map(p=>{
            const el = p.el; const t = teamOf(bs, el.team);
            const role = p.is_captain? '<span class="badge badge-ok">C</span>' : p.is_vice_captain? '<span class="badge badge-mute">VC</span>' : '';
            const sb = statusBadge(el);
            return `<tr>
              <td><div class="player-cell"><img class="crest" src="${crestUrl(t.code)}" onerror="this.style.display='none'"/><div><div class="pname">${esc(el.web_name)} ${sb?`<span class="badge ${sb.cls}" style="margin-left:6px;">${sb.label}</span>`:''}</div><div class="psub">${esc(t.short_name)} · ${p.multiplier===0?'benched':'starting'}</div></div></div></td>
              <td class="mono">${priceFmt(el.now_cost)}</td>
              <td class="mono">${el.form}</td>
              <td class="mono">${el.ep_next}</td>
              <td>${role}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `).join('');
}

/* ----------------------------- Pitch (visual) view ------------------------- */
function playerChip(p, bs, opts={}){
  const el = p.el;
  const t = teamOf(bs, el.team);
  const isGK = el.element_type === 1;
  const roleBadge = p.is_captain? '<span class="chip-role chip-role-c">C</span>'
    : p.is_vice_captain? '<span class="chip-role chip-role-vc">VC</span>' : '';
  const sb = statusBadge(el);
  const pts = el.event_points ?? 0;
  return `
    <div class="pitch-chip">
      ${roleBadge}
      <div class="pitch-kit">
        <img src="${kitUrl(t.code, isGK)}" alt="" onerror="this.onerror=null;this.src='${crestUrl(t.code)}';this.classList.add('is-crest-fallback');"/>
      </div>
      <div class="pitch-name-tag">
        ${esc(el.web_name)}${sb?` <span class="chip-flag" title="${esc(sb.label)}">!</span>`:''}
      </div>
      <div class="pitch-pts-tag">${pts}</div>
    </div>
  `;
}

function pitchViewHtml(groups, bs){
  const byPos = Object.fromEntries(groups.map(g=>[g.pos, g.players]));
  const starters = pt => (byPos[pt]||[]).filter(p=>p.multiplier>0);
  const bench = pt => (byPos[pt]||[]).filter(p=>p.multiplier===0);

  const rows = [
    { label:'GKP', players: starters('GKP') },
    { label:'DEF', players: starters('DEF') },
    { label:'MID', players: starters('MID') },
    { label:'FWD', players: starters('FWD') },
  ].filter(r=>r.players.length);

  const benchPlayers = [...bench('GKP'), ...bench('DEF'), ...bench('MID'), ...bench('FWD')];

  return `
    <div class="pitch-wrap">
      <div class="pitch-field">
        ${rows.map(r=>`
          <div class="pitch-row">
            ${r.players.map(p=>playerChip(p, bs)).join('')}
          </div>
        `).join('')}
      </div>
    </div>
    ${benchPlayers.length? `
      <div class="section-label" style="margin-top:20px;">Substitutes</div>
      <div class="pitch-bench">
        ${benchPlayers.map(p=>playerChip(p, bs)).join('')}
      </div>
    ` : ''}
  `;
}
