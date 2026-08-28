import { state } from '../state.js';
import { ensureBootstrap, ensureAllFixtures } from '../api.js';
import { teamOf, crestUrl } from '../scoring.js';
import { esc } from '../utils.js';
import { skeletonRows } from '../skeletons.js';
import { ToolShell } from '../tool-shell.js';
import { renderRoot } from '../app.js';

const TITLE = 'Fixtures Calendar';
const DESC = 'Every Premier League fixture this season, month by month.';

// Which month is currently expanded/shown. null = pick the month containing
// today's date (or the nearest upcoming one) the first time this loads.
let currentMonthKey = null;

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* ---- Fixtures Calendar ---- */
export async function CalendarView(){
  renderRoot(ToolShell(TITLE, DESC, skeletonRows(8)));
  try{
    const bs = await ensureBootstrap();
    const fixtures = await ensureAllFixtures();
    renderCalendarBody(bs, fixtures);
  }catch(e){
    renderRoot(ToolShell(TITLE, DESC, `<div class="err-box">${esc(state.errors.allFixtures || state.errors.bootstrap || e.message)}</div>`));
  }
}

function monthKey(date){
  return `${date.getFullYear()}-${String(date.getMonth()).padStart(2,'0')}`;
}

function renderCalendarBody(bs, fixtures){
  // Fixtures without a kickoff_time yet (postponed / not scheduled) are
  // dropped from the calendar — there's no month to bucket them under.
  const withDates = fixtures.filter(f=>f.kickoff_time);
  const byMonth = new Map();
  withDates.forEach(f=>{
    const d = new Date(f.kickoff_time);
    const key = monthKey(d);
    if(!byMonth.has(key)) byMonth.set(key, { year:d.getFullYear(), month:d.getMonth(), fixtures:[] });
    byMonth.get(key).fixtures.push(f);
  });

  const monthKeys = [...byMonth.keys()].sort();
  if(!monthKeys.length){
    renderRoot(ToolShell(TITLE, DESC, `<div class="empty-box">No fixtures found.</div>`));
    return;
  }

  if(!currentMonthKey || !byMonth.has(currentMonthKey)){
    // Default to the month containing the next unplayed fixture, or the
    // last month in the list if the whole season is already finished.
    const now = Date.now();
    const upcoming = withDates.find(f=>new Date(f.kickoff_time).getTime() >= now);
    currentMonthKey = upcoming ? monthKey(new Date(upcoming.kickoff_time)) : monthKeys[monthKeys.length-1];
  }

  const idx = monthKeys.indexOf(currentMonthKey);
  const monthData = byMonth.get(currentMonthKey);
  const monthLabel = `${MONTH_NAMES[monthData.month]} ${monthData.year}`;

  const rows = [...monthData.fixtures].sort((a,b)=> new Date(a.kickoff_time) - new Date(b.kickoff_time));

  // Group fixtures within the month by calendar day so it reads like an
  // actual calendar rather than one long flat list.
  const byDay = new Map();
  rows.forEach(f=>{
    const d = new Date(f.kickoff_time);
    const dayKey = d.toDateString();
    if(!byDay.has(dayKey)) byDay.set(dayKey, { date:d, fixtures:[] });
    byDay.get(dayKey).fixtures.push(f);
  });

  const dayGroupsHtml = [...byDay.values()].map(group=>{
    const dayLabel = group.date.toLocaleDateString(undefined, { weekday:'long', day:'numeric', month:'long' });
    const fixturesHtml = group.fixtures.map(f=>{
      const home = teamOf(bs, f.team_h);
      const away = teamOf(bs, f.team_a);
      const kickoff = new Date(f.kickoff_time).toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit' });
      const played = f.finished;
      const scoreOrTime = played
        ? `<span class="cal-score">${f.team_h_score} - ${f.team_a_score}</span>`
        : `<span class="cal-kickoff">${esc(kickoff)}</span>`;
      return `
        <div class="cal-fixture">
          <div class="cal-team cal-team-home">
            <span class="cal-team-name">${esc(home.name)}</span>
            <img class="crest" src="${crestUrl(home.code)}" onerror="this.style.display='none'"/>
          </div>
          <div class="cal-center">${scoreOrTime}${played?'<span class="cal-ft">FT</span>':''}</div>
          <div class="cal-team cal-team-away">
            <img class="crest" src="${crestUrl(away.code)}" onerror="this.style.display='none'"/>
            <span class="cal-team-name">${esc(away.name)}</span>
          </div>
        </div>`;
    }).join('');
    return `
      <div class="cal-day-group">
        <div class="cal-day-label">${esc(dayLabel)}</div>
        ${fixturesHtml}
      </div>`;
  }).join('');

  const body = `
    <div class="gw-nav">
      <button class="gw-arrow" id="calPrev" ${idx<=0?'disabled':''} aria-label="Previous month">←</button>
      <div class="gw-label">${esc(monthLabel)}</div>
      <button class="gw-arrow" id="calNext" ${idx>=monthKeys.length-1?'disabled':''} aria-label="Next month">→</button>
    </div>
    <div class="cal-month">
      ${dayGroupsHtml}
    </div>
  `;

  renderRoot(ToolShell(TITLE, DESC, body));

  document.getElementById('calPrev')?.addEventListener('click', ()=>{
    if(idx>0){ currentMonthKey = monthKeys[idx-1]; renderCalendarBody(bs, fixtures); }
  });
  document.getElementById('calNext')?.addEventListener('click', ()=>{
    if(idx<monthKeys.length-1){ currentMonthKey = monthKeys[idx+1]; renderCalendarBody(bs, fixtures); }
  });
}
