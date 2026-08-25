import { state } from '../state.js';
import { POS_SHORT } from '../constants.js';
import { ensureBootstrap, ensurePlayerSummary } from '../api.js';
import { teamOf, posOf, priceFmt, crestUrl, photoUrl } from '../scoring.js';
import { esc } from '../utils.js';
import { skeletonTable } from '../skeletons.js';
import { ToolShell } from '../tool-shell.js';
import { renderRoot } from '../app.js';

/* ---- Player Explorer ---- */
let explorerState = {q:'', pos:'all', team:'all', sort:'total_points'};

export async function PlayersView(){
  renderRoot(ToolShell('Player Explorer','Search, filter and dig into any player in the game.', skeletonTable(8)));
  try{
    const bs = await ensureBootstrap();
    renderPlayersBody(bs);
  }catch(e){
    renderRoot(ToolShell('Player Explorer','Search, filter and dig into any player in the game.', `<div class="err-box">${esc(state.errors.bootstrap||e.message)}</div>`));
  }
}
function renderPlayersBody(bs){
  const toolbar = `
    <div class="tool-toolbar">
      <input type="text" id="pxSearch" placeholder="Search players…" value="${esc(explorerState.q)}" style="min-width:200px;"/>
      <select id="pxPos">
        <option value="all">All positions</option>
        ${[1,2,3,4].map(pt=>`<option value="${pt}" ${explorerState.pos==String(pt)?'selected':''}>${POS_SHORT[pt]}</option>`).join('')}
      </select>
      <select id="pxTeam">
        <option value="all">All teams</option>
        ${bs.teams.map(t=>`<option value="${t.id}" ${explorerState.team==String(t.id)?'selected':''}>${esc(t.name)}</option>`).join('')}
      </select>
      <select id="pxSort">
        <option value="total_points">Sort: Total points</option>
        <option value="form">Sort: Form</option>
        <option value="now_cost">Sort: Price</option>
        <option value="selected_by_percent">Sort: Ownership</option>
      </select>
    </div>`;

  let list = bs.elements.slice();
  if(explorerState.q) list = list.filter(e=> (e.web_name+' '+e.first_name+' '+e.second_name).toLowerCase().includes(explorerState.q.toLowerCase()));
  if(explorerState.pos!=='all') list = list.filter(e=>String(e.element_type)===String(explorerState.pos));
  if(explorerState.team!=='all') list = list.filter(e=>String(e.team)===String(explorerState.team));
  list.sort((a,b)=> parseFloat(b[explorerState.sort])-parseFloat(a[explorerState.sort]));
  list = list.slice(0,60);

  const table = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Player</th><th>Pos</th><th>Price</th><th>Form</th><th>Points</th><th>Own%</th></tr></thead>
        <tbody>
          ${list.map(el=>{
            const t = teamOf(bs, el.team);
            return `<tr class="px-row" data-id="${el.id}" style="cursor:pointer;">
              <td><div class="player-cell"><img class="crest" src="${crestUrl(t.code)}" onerror="this.style.display='none'"/><div><div class="pname">${esc(el.web_name)}</div><div class="psub">${esc(t.short_name)}</div></div></div></td>
              <td><span class="pos-pill pos-${posOf(el)}">${posOf(el)}</span></td>
              <td class="mono">${priceFmt(el.now_cost)}</td>
              <td class="mono">${el.form}</td>
              <td class="mono">${el.total_points}</td>
              <td class="mono">${el.selected_by_percent}%</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;

  renderRoot(ToolShell('Player Explorer','Search, filter and dig into any player in the game.', toolbar + table + `<div id="playerModalRoot"></div>`));

  document.getElementById('pxSearch').addEventListener('input', e=>{ explorerState.q=e.target.value; renderPlayersBody(bs); });
  document.getElementById('pxPos').addEventListener('change', e=>{ explorerState.pos=e.target.value; renderPlayersBody(bs); });
  document.getElementById('pxTeam').addEventListener('change', e=>{ explorerState.team=e.target.value; renderPlayersBody(bs); });
  document.getElementById('pxSort').addEventListener('change', e=>{ explorerState.sort=e.target.value; renderPlayersBody(bs); });
  document.querySelectorAll('.px-row').forEach(row=>{
    row.addEventListener('click', ()=> openPlayerModal(parseInt(row.dataset.id), bs));
  });
}

async function openPlayerModal(id, bs){
  const el = bs.elements.find(e=>e.id===id);
  const t = teamOf(bs, el.team);
  const mount = document.getElementById('playerModalRoot');
  mount.innerHTML = `
    <div class="modal-backdrop" id="modalBackdrop">
      <div class="modal">
        <button class="modal-close" id="modalCloseBtn">✕</button>
        <div style="display:flex;gap:14px;align-items:center;">
          <img src="${photoUrl(el.code)}" style="width:56px;height:70px;object-fit:cover;border-radius:8px;background:var(--surface-2);" onerror="this.style.display='none'"/>
          <div>
            <div style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:19px;">${esc(el.first_name)} ${esc(el.web_name)}</div>
            <div style="color:var(--text-dim);font-size:13px;">${esc(t.name)} · <span class="pos-pill pos-${posOf(el)}">${posOf(el)}</span> · ${priceFmt(el.now_cost)}</div>
          </div>
        </div>
        <div class="grid grid-3" style="margin-top:16px;">
          <div class="stat-tile"><div class="v mono">${el.total_points}</div><div class="l">Total pts</div></div>
          <div class="stat-tile"><div class="v mono">${el.form}</div><div class="l">Form</div></div>
          <div class="stat-tile"><div class="v mono">${el.selected_by_percent}%</div><div class="l">Owned</div></div>
        </div>
        <div class="section-label">Points — recent gameweeks</div>
        <canvas id="ptsChart" height="120"></canvas>
        <div class="section-label">Underlying stats</div>
        <div class="grid grid-3">
          <div class="stat-tile"><div class="v mono">${el.expected_goals}</div><div class="l">xG</div></div>
          <div class="stat-tile"><div class="v mono">${el.expected_assists}</div><div class="l">xA</div></div>
          <div class="stat-tile"><div class="v mono">${el.minutes}</div><div class="l">Minutes</div></div>
        </div>
        ${el.news? `<div class="section-label">News</div><div style="font-size:13px;color:var(--text-dim);line-height:1.5;">${esc(el.news)}</div>`:''}
      </div>
    </div>`;
  document.getElementById('modalCloseBtn').addEventListener('click', ()=> mount.innerHTML='');
  document.getElementById('modalBackdrop').addEventListener('click', e=>{ if(e.target.id==='modalBackdrop') mount.innerHTML=''; });

  try{
    const summary = await ensurePlayerSummary(id);
    const hist = summary.history.slice(-10);
    const ctx = document.getElementById('ptsChart');
    if(ctx && window.Chart){
      new Chart(ctx, {
        type:'bar',
        data:{
          labels: hist.map(h=>'GW'+h.round),
          datasets:[{ label:'Points', data: hist.map(h=>h.total_points), backgroundColor: getComputedStyle(document.body).getPropertyValue('--accent') || '#00E28A', borderRadius:5 }]
        },
        options:{
          plugins:{legend:{display:false}},
          scales:{
            x:{ticks:{color:getComputedStyle(document.body).getPropertyValue('--text-dim')}, grid:{display:false}},
            y:{ticks:{color:getComputedStyle(document.body).getPropertyValue('--text-dim')}, grid:{color:getComputedStyle(document.body).getPropertyValue('--border')}}
          }
        }
      });
    }
  }catch(e){
    const ctx = document.getElementById('ptsChart');
    if(ctx) ctx.replaceWith(Object.assign(document.createElement('div'),{className:'empty-box', textContent:'Points history unavailable right now.'}));
  }
}
