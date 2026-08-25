import { state } from './state.js';

/* -------------------------------- Theming -------------------------------- */
export function applyTheme(){
  document.body.setAttribute('data-theme', state.theme);
  document.getElementById('themeToggle').textContent = state.theme==='dark' ? '🌙' : '☀️';
}

export function wireThemeToggle(){
  document.getElementById('themeToggle').addEventListener('click', ()=>{
    state.theme = state.theme==='dark' ? 'light' : 'dark';
    applyTheme();
    try{ window.storage.set('aufside:theme', state.theme); }catch(e){}
  });
}
