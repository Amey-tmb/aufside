import { state } from '../state.js';
import { ensureBootstrap, ensureFixtures } from '../api.js';
import { teamOf, crestUrl } from '../scoring.js';
import { esc } from '../utils.js';
import { skeletonTable } from '../skeletons.js';
import { ToolShell } from '../tool-shell.js';
import { renderRoot } from '../app.js';

/* ---- Fixture Difficulty ---- */
export async function FixturesView(){
  renderRoot(ToolShell('Fixture Difficulty','Next 5 gameweeks for every club — green is easy, red is hard.', skeletonTable(8)));
  try{
    const bs = await ensureBootstrap();
    const fixtures = await ensureFixtures();
    renderFixturesBody(bs, fixtures);
  }catch(e){
    renderRoot(ToolShell('Fixture Difficulty','Next 5 gameweeks for every club — green is easy, red is hard.', `<div class="err-box">${esc(state.errors.fixtures||state.errors.bootstrap||e.message)}</div>`));
  }
}
function renderFixturesBody(bs, fixtures){
  const upcoming = fixtures.filter(f=>!f.finished && f.event).sort((a,b)=>a.event-b.event);
  const nextEvents = [...new Set(upcoming.map(f=>f.event))].slice(0,5);

  const rows = bs.teams.map(team=>{
    const cells = nextEvents.map(gw=>{
      const f = upcoming.find(fx=>fx.event===gw && (fx.team_h===team.id || fx.team_a===team.id));
      if(!f) return `<td><span class="fixture-cell badge-mute" style="background:var(--surface-2);">—</span></td>`;
      const isHome = f.team_h===team.id;
      const opp = teamOf(bs, isHome? f.team_a : f.team_h);
      const diff = isHome? f.team_h_difficulty : f.team_a_difficulty;
      return `<td><span class="fixture-cell diff-${diff||3}">${esc(opp.short_name)} ${isHome?'(H)':'(A)'}</span></td>`;
    }).join('');
    return `<tr><td><div class="player-cell"><img class="crest" src="${crestUrl(team.code)}" onerror="this.style.display='none'"/><span class="pname">${esc(team.name)}</span></div></td>${cells}</tr>`;
  }).join('');

  const body = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Team</th>${nextEvents.map(gw=>`<th>GW${gw}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="display:flex;gap:8px;margin-top:14px;font-size:12px;color:var(--text-dim);align-items:center;">
      Easier <div class="fixture-cell diff-1" style="width:28px;">&nbsp;</div><div class="fixture-cell diff-2" style="width:28px;">&nbsp;</div><div class="fixture-cell diff-3" style="width:28px;">&nbsp;</div><div class="fixture-cell diff-4" style="width:28px;">&nbsp;</div><div class="fixture-cell diff-5" style="width:28px;">&nbsp;</div> Harder
    </div>
  `;
  renderRoot(ToolShell('Fixture Difficulty','Next 5 gameweeks for every club — green is easy, red is hard.', body));
}
