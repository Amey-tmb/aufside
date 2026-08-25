import { state } from '../state.js';
import { ensureBootstrap, ensureFixtures, loadPicksForTeam } from '../api.js';
import { teamOf, posOf, priceFmt, reasonFor, buildTransferSuggestions } from '../scoring.js';
import { esc } from '../utils.js';
import { skeletonRows } from '../skeletons.js';
import { ToolShell, NeedTeamPrompt, wireInlineTeamForm } from '../tool-shell.js';
import { renderRoot } from '../app.js';

/* ---- Transfer Recommendations ---- */
export async function TransfersView(){
  if(!state.teamId){
    renderRoot(ToolShell('Transfer Recommendations','Data-driven swaps to boost next gameweek.', NeedTeamPrompt('Transfer Recommendations')));
    wireInlineTeamForm(TransfersView);
    return;
  }
  renderRoot(ToolShell('Transfer Recommendations','Data-driven swaps to boost next gameweek.', skeletonRows(3)));
  try{
    const bs = await ensureBootstrap();
    const fixtures = await ensureFixtures();
    if(!state.picks || String(state.picks.entry_history?.entry)!==String(state.teamId)){
      await loadPicksForTeam(state.teamId);
    }
    renderTransfersBody(bs, fixtures);
  }catch(e){
    renderRoot(ToolShell('Transfer Recommendations','Data-driven swaps to boost next gameweek.', `<div class="err-box">${esc(state.errors.picks || state.errors.bootstrap || e.message)}</div>`));
  }
}
function renderTransfersBody(bs, fixtures){
  const byId = Object.fromEntries(bs.elements.map(e=>[e.id,e]));
  const squadElements = state.picks.picks.map(p=>byId[p.element]);
  const bank = state.picks.entry_history?.bank ?? 0;
  const suggestions = buildTransferSuggestions(bs, fixtures, squadElements, bank, 3);

  const body = suggestions.length===0 ? `
    <div class="empty-box">Your squad already scores well against form, fixtures and underlying stats — no strong upgrades found this week. 👍</div>
  ` : `
    <div class="grid grid-2">
      ${suggestions.map(s=>{
        const outT = teamOf(bs, s.out.el.team), inT = teamOf(bs, s.in.cand.team);
        const gain = (s.in.total - s.out.total).toFixed(1);
        return `
        <div class="card swap-card">
          <span class="pos-pill pos-${posOf(s.out.el)}">${posOf(s.out.el)}</span>
          <div class="swap-row">
            <div class="swap-player">
              <div class="pname">${esc(s.out.el.web_name)}</div>
              <div class="psub">${esc(outT.short_name)} · ${priceFmt(s.out.el.now_cost)} · form ${s.out.el.form}</div>
            </div>
            <div class="swap-arrow">→</div>
            <div class="swap-player" style="background:var(--accent-dim);">
              <div class="pname">${esc(s.in.cand.web_name)}</div>
              <div class="psub">${esc(inT.short_name)} · ${priceFmt(s.in.cand.now_cost)} · form ${s.in.cand.form}</div>
            </div>
          </div>
          <div class="swap-reason">
            <span class="swap-gain">+${gain} score</span> — ${reasonFor(s.out, s.in, bs)}.
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
  renderRoot(ToolShell('Transfer Recommendations','Data-driven swaps to boost next gameweek.', body));
}
