import { esc } from './utils.js';

/* ------------------------------ Match cards ------------------------------ */
export function matchCardsHtml(events){
  if(events.length===0) return `<div class="empty-box">No matches right now.</div>`;
  return `<div class="matches-wrap">${events.map(ev=>{
    const comp = ev.competitions?.[0];
    const [home, away] = comp?.competitors || [];
    const statusType = comp?.status?.type || {};
    const isLive = statusType.state==='in';
    return `<div class="match-card">
      <div class="match-team home">
        <img src="${home?.team?.logo||''}" onerror="this.style.display='none'"/>
        <span>${esc(home?.team?.shortDisplayName||'')}</span>
      </div>
      <div class="match-score-wrap">
        <div class="match-score">${esc(home?.score||'-')} : ${esc(away?.score||'-')}</div>
        <div class="match-status ${isLive?'is-live':''}">${esc(statusType.description||'')}</div>
      </div>
      <div class="match-team away">
        <img src="${away?.team?.logo||''}" onerror="this.style.display='none'"/>
        <span>${esc(away?.team?.shortDisplayName||'')}</span>
      </div>
    </div>`;
  }).join('')}</div>`;
}
