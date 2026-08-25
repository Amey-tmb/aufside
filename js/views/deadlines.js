import { state } from '../state.js';
import { ensureBootstrap } from '../api.js';
import { esc, fmtDate, timeUntil, gcalLink } from '../utils.js';
import { skeletonRows } from '../skeletons.js';
import { ToolShell } from '../tool-shell.js';
import { renderRoot } from '../app.js';

/* ---- Deadline Reminders ---- */
export async function DeadlinesView(){
  renderRoot(ToolShell('Deadline Reminders','Never miss a gameweek deadline again.', skeletonRows(4)));
  try{
    const bs = await ensureBootstrap();
    renderDeadlinesBody(bs);
  }catch(e){
    renderRoot(ToolShell('Deadline Reminders','Never miss a gameweek deadline again.', `<div class="err-box">${esc(state.errors.bootstrap||e.message)}</div>`));
  }
}
function renderDeadlinesBody(bs){
  const upcoming = bs.events.filter(e=>new Date(e.deadline_time) > new Date()).slice(0,6);
  const body = upcoming.length===0 ? `<div class="empty-box">No upcoming deadlines found — the season may have ended.</div>` : `
    ${upcoming.map(ev=>`
      <div class="card deadline-card" style="margin-bottom:10px;">
        <div class="dl-left">
          <div class="dl-gw">${esc(ev.name)}</div>
          <div class="dl-date">${fmtDate(ev.deadline_time)}</div>
        </div>
        <div class="dl-count">${timeUntil(ev.deadline_time)}</div>
        <a class="cal-btn" target="_blank" rel="noopener" href="${gcalLink('FPL Deadline: '+ev.name, 'Set your Fantasy Premier League team before this deadline.', ev.deadline_time, 30)}">＋ Add to Google Calendar</a>
      </div>
    `).join('')}
  `;
  renderRoot(ToolShell('Deadline Reminders','Never miss a gameweek deadline again.', body));
}
