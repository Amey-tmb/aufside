import { state } from './state.js';
import { saveTeamId } from './storage.js';

/* ------------------------------ Page shell ------------------------------ */
export function ToolShell(title, desc, bodyHtml){
  return `
  <div class="page">
    <a class="back-link" href="#/">← Back home</a>
    <div class="page-head">
      <h2>${title}</h2>
      <p>${desc}</p>
    </div>
    ${bodyHtml}
  </div>`;
}

export function NeedTeamPrompt(toolLabel){
  return `
    <div class="card" style="text-align:center;padding:40px 20px;">
      <div style="font-size:28px;margin-bottom:10px;">👤</div>
      <div style="font-weight:600;margin-bottom:6px;">No team loaded yet</div>
      <div style="color:var(--text-dim);font-size:13.5px;margin-bottom:18px;">Enter your FPL Team ID below to unlock ${toolLabel}.</div>
      <form id="inlineTeamForm" style="display:flex;gap:8px;max-width:360px;margin:0 auto;">
        <input type="text" id="inlineTeamInput" placeholder="Team ID" style="flex:1;background:var(--surface-2);border:1px solid var(--border);border-radius:9px;padding:10px 12px;color:var(--text);outline:none;">
        <button type="submit" style="background:var(--accent);color:#04140D;border:none;border-radius:9px;padding:0 16px;font-weight:700;">Load</button>
      </form>
    </div>`;
}

// `onLoaded` is called after a team ID is submitted, so each view can decide
// how to proceed (re-render itself, navigate elsewhere, etc.) instead of this
// shared component reaching into a specific view's render function.
export function wireInlineTeamForm(onLoaded){
  const f = document.getElementById('inlineTeamForm');
  if(!f) return;
  f.addEventListener('submit', e=>{
    e.preventDefault();
    const v = document.getElementById('inlineTeamInput').value.trim();
    if(!v) return;
    state.teamId = v; saveTeamId(v);
    if(typeof onLoaded === 'function') onLoaded();
  });
}
