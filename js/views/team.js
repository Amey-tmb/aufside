import { esc } from '../utils.js';
import { fetchWithTimeout } from '../api.js';
import { skeletonRows } from '../skeletons.js';
import { ToolShell } from '../tool-shell.js';
import { renderRoot } from '../app.js';

const POSITION_GROUPS = ['Goalkeeper', 'Defence', 'Midfield', 'Offence'];
const POSITION_LABEL = {Goalkeeper:'Goalkeepers', Defence:'Defenders', Midfield:'Midfielders', Offence:'Forwards'};

function age(dob){
  if(!dob) return null;
  const d = new Date(dob);
  if(isNaN(d)) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25*24*3600*1000));
}

/* ---- Team detail ---- */
export async function TeamView(id){
  renderRoot(ToolShell('Team','Squad and club info.', skeletonRows(6)));
  try{
    const data = await fetchWithTimeout(`/api/team?id=${encodeURIComponent(id)}`, 10000);
    renderTeamBody(data);
  }catch(e){
    renderRoot(ToolShell('Team','Squad and club info.', `<div class="err-box">Could not load this club (${esc(e.message)}).</div>`));
  }
}

function renderTeamBody(data){
  const team = data.team || {};
  const squad = data.squad || [];
  const lineup = data.lineup;
  const recentMatch = data.recentMatch;

  const header = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
      <img src="${team.crest||''}" style="width:56px;height:56px;object-fit:contain;" onerror="this.style.display='none'"/>
      <div>
        <div style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:22px;">${esc(team.name||'')}</div>
        <div style="color:var(--text-dim);font-size:13px;">${esc(team.venue||'')}${team.coach?` · Coach: ${esc(team.coach)}`:''}</div>
      </div>
    </div>`;

  let lineupHtml = '';
  if(lineup && lineup.length){
    lineupHtml = `
      <div class="section-label">Lineup — last match${recentMatch?` vs ${esc(recentMatch.opponent)} (${recentMatch.isHome?'H':'A'})`:''}</div>
      <div class="grid grid-2" style="margin-bottom:26px;">
        ${lineup.map(p=>`
          <div class="card" style="display:flex;align-items:center;gap:10px;padding:10px 14px;">
            <span class="mono" style="color:var(--text-dim);min-width:22px;">${p.shirtNumber??''}</span>
            <span class="pname">${esc(p.name||'')}</span>
            <span class="psub" style="margin-left:auto;">${esc(p.position||'')}</span>
          </div>`).join('')}
      </div>`;
  }else{
    lineupHtml = `<div class="empty-box" style="margin-bottom:26px;">No confirmed lineup available yet — showing the full squad below.</div>`;
  }

  const bySection = POSITION_GROUPS.map(pos=>({
    pos, label: POSITION_LABEL[pos],
    players: squad.filter(p=>p.position===pos)
  })).filter(g=>g.players.length);

  const squadHtml = squad.length===0 ? `<div class="empty-box">Squad data unavailable for this club right now.</div>` : bySection.map(g=>`
    <div class="section-label">${g.label}</div>
    <div class="table-wrap" style="margin-bottom:16px;">
      <table>
        <thead><tr><th>#</th><th>Player</th><th>Nationality</th><th>Age</th></tr></thead>
        <tbody>
          ${g.players.map(p=>`<tr>
            <td class="mono">${p.shirtNumber??''}</td>
            <td class="pname">${esc(p.name||'')}</td>
            <td>${esc(p.nationality||'')}</td>
            <td class="mono">${age(p.dateOfBirth) ?? ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `).join('');

  const body = header + lineupHtml + `<div class="section-label">Full squad</div>` + squadHtml;
  renderRoot(ToolShell(esc(team.name||'Team'),'Squad and club info.', body));
}
