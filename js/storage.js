import { state } from './state.js';

/* ------------------------------- Storage -------------------------------- */
export async function loadSavedTeamId(){
  try{
    const r = await window.storage.get('aufside:teamId');
    if(r && r.value) state.teamId = r.value;
  }catch(e){ /* no saved id yet */ }
}
export async function saveTeamId(id){
  try{ await window.storage.set('aufside:teamId', String(id)); }catch(e){}
}
export async function loadSavedLeagueId(){
  try{
    const r = await window.storage.get('aufside:leagueId');
    if(r && r.value) state.leagueId = r.value;
  }catch(e){ /* no saved id yet */ }
}
export async function saveLeagueId(id){
  try{ await window.storage.set('aufside:leagueId', String(id)); }catch(e){}
}
