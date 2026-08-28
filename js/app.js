import { state } from './state.js';
import { loadSavedTeamId, loadSavedLeagueId } from './storage.js';
import { currentPath } from './router.js';
import { applyTheme, wireThemeToggle } from './theme.js';
import { loadSavedAccent, wireAccentPicker } from './accent.js';
import { wireInstallPrompt } from './install.js';
import { buildNavMenu, wireNavTrigger } from './nav.js';
import { ensureBootstrap } from './api.js';
import { LandingView, loadHomeLive, loadHomeNews } from './views/landing.js';
import { MyTeamView } from './views/my-team.js';
import { TransfersView } from './views/transfers.js';
import { InjuriesView } from './views/injuries.js';
import { TransferNewsView } from './views/transfer-news.js';
import { PlayersView } from './views/players.js';
import { FixturesView } from './views/fixtures.js';
import { CalendarView } from './views/calendar.js';
import { LiveView } from './views/live.js';
import { MiniLeagueView } from './views/mini-league.js';
import { DeadlinesView } from './views/deadlines.js';
import { TeamView } from './views/team.js';

/* ------------------------------- Root render ------------------------------- */
export function renderRoot(html){
  document.getElementById('root').innerHTML = html;
}

export async function render(){
  buildNavMenu();
  const path = currentPath();
  if(path==='/'){
    renderRoot(LandingView());
    loadHomeLive();
    loadHomeNews();
    if(!state.bootstrap){
      ensureBootstrap().catch(()=>{});
    }
    return;
  }
  switch(path){
    case '/my-team': return MyTeamView();
    case '/transfers': return TransfersView();
    case '/injuries': return InjuriesView();
    case '/transfer-news': return TransferNewsView();
    case '/players': return PlayersView();
    case '/fixtures': return FixturesView();
    case '/calendar': return CalendarView();
    case '/live': return LiveView();
    case '/mini-league': return MiniLeagueView();
    case '/deadlines': return DeadlinesView();
    default:
      if(path.startsWith('/team/')) return TeamView(path.slice('/team/'.length));
      renderRoot(`<div class="page"><div class="empty-box">Page not found. <a href="#/" style="color:var(--accent);">Go home</a></div></div>`);
  }
}

/* -------------------------------- Boot -------------------------------- */
function wireGlobalNav(){
  window.addEventListener('hashchange', render);
  document.querySelector('.brand').addEventListener('click', ()=>{ location.hash = '/'; });
  wireThemeToggle();
  wireNavTrigger();
  wireInstallPrompt();
  wireAccentPicker();
}

(async function boot(){
  wireGlobalNav();
  try{
    const t = await window.storage.get('aufside:theme');
    if(t && t.value) state.theme = t.value;
  }catch(e){}
  applyTheme();
  await loadSavedAccent();
  await loadSavedTeamId();
  await loadSavedLeagueId();
  render();
})();
