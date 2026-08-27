import { esc } from './utils.js';

/* ------------------------------ Match cards ------------------------------ */
function teamLinkOpen(id){
  return id ? `<a class="team-link" href="#/team/${id}">` : `<span class="team-link">`;
}
function teamLinkClose(id){
  return id ? `</a>` : `</span>`;
}
export function matchCardsHtml(events){
  if(events.length===0) return `<div class="empty-box">No matches this gameweek.</div>`;
  return `<div class="matches-wrap">${events.map(ev=>{
    const comp = ev.competitions?.[0];
    const [home, away] = comp?.competitors || [];
    const statusType = comp?.status?.type || {};
    const isLive = statusType.state==='in';
    const homeId = home?.team?.id, awayId = away?.team?.id;
    return `<div class="match-card">
      ${teamLinkOpen(homeId)}<div class="match-team home">
        <img src="${home?.team?.logo||''}" onerror="this.style.display='none'"/>
        <span>${esc(home?.team?.shortDisplayName||'')}</span>
      </div>${teamLinkClose(homeId)}
      <div class="match-score-wrap">
        <div class="match-score">${esc(home?.score ?? '-')} : ${esc(away?.score ?? '-')}</div>
        <div class="match-status ${isLive?'is-live':''}">${esc(statusType.description||'')}</div>
      </div>
      ${teamLinkOpen(awayId)}<div class="match-team away">
        <img src="${away?.team?.logo||''}" onerror="this.style.display='none'"/>
        <span>${esc(away?.team?.shortDisplayName||'')}</span>
      </div>${teamLinkClose(awayId)}
    </div>`;
  }).join('')}</div>`;
}
