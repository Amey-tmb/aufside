/* ------------------------------ App state ------------------------------ */
export const state = {
  theme:'dark',
  teamId:null,
  leagueId:null,
  bootstrap:null,      // bootstrap-static payload
  fixtures:null,       // fixtures/ payload
  picks:null,          // entry/{id}/event/{gw}/picks payload
  entryInfo:null,       // entry/{id} payload (manager info)
  loadingBootstrap:false,
  loadingPicks:false,
  errors:{},
  playerSummaryCache:{},
};
