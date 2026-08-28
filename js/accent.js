/* ---- Accent color picker ----
   Lets a person recolor the app's accent (buttons, highlights, captain
   badge, etc.) to their favourite club's primary colour, or any custom
   hex they like. Saved locally via window.storage so it persists between
   visits — this never touches any API.
*/
const STORAGE_KEY = 'aufside:accent';
const DEFAULT_ACCENT = '#DC052D'; // Aufside's own default red

// A representative primary colour for each current Premier League club.
// These are approximate brand/kit colours, not official hex codes from the
// clubs themselves — good enough for a fun theming feature.
export const CLUB_COLORS = [
  { name:'Arsenal', color:'#EF0107' },
  { name:'Aston Villa', color:'#670E36' },
  { name:'Bournemouth', color:'#DA291C' },
  { name:'Brentford', color:'#E30613' },
  { name:'Brighton', color:'#0057B8' },
  { name:'Burnley', color:'#6C1D45' },
  { name:'Chelsea', color:'#034694' },
  { name:'Crystal Palace', color:'#1B458F' },
  { name:'Everton', color:'#003399' },
  { name:'Fulham', color:'#000000' },
  { name:'Leeds United', color:'#FFCD00' },
  { name:'Liverpool', color:'#C8102E' },
  { name:'Man City', color:'#6CABDD' },
  { name:'Man United', color:'#DA291C' },
  { name:'Newcastle', color:'#241F20' },
  { name:'Nottingham Forest', color:'#DD0000' },
  { name:'Sunderland', color:'#E03A3E' },
  { name:'Tottenham', color:'#132257' },
  { name:'West Ham', color:'#7A263A' },
  { name:'Wolves', color:'#FDB913' },
];

function hexWithAlpha(hex, alphaHex){
  // Appends an 8-digit-hex alpha channel, matching the "#RRGGBBAA" style
  // already used for --accent-dim throughout style.css (e.g. #DC052D22).
  return hex.replace('#','#') + alphaHex;
}

export function applyAccent(hex){
  const root = document.documentElement;
  root.style.setProperty('--accent', hex);
  root.style.setProperty('--accent-dim', hexWithAlpha(hex, '22'));
}

export async function loadSavedAccent(){
  try{
    const saved = await window.storage.get(STORAGE_KEY);
    const hex = (saved && saved.value) || DEFAULT_ACCENT;
    applyAccent(hex);
    return hex;
  }catch(e){
    applyAccent(DEFAULT_ACCENT);
    return DEFAULT_ACCENT;
  }
}

async function saveAccent(hex){
  applyAccent(hex);
  try{ await window.storage.set(STORAGE_KEY, hex); }catch(e){}
}

function buildPanelHtml(){
  return `
    <div class="accent-panel-inner">
      <div class="accent-panel-title">Accent colour</div>
      <div class="accent-swatches">
        ${CLUB_COLORS.map(c=>`
          <button class="accent-swatch" data-color="${c.color}" title="${c.name}" style="background:${c.color};"></button>
        `).join('')}
      </div>
      <div class="accent-custom-row">
        <input type="color" id="accentCustomInput" value="${DEFAULT_ACCENT}" title="Custom colour">
        <span>Custom</span>
        <button class="accent-reset-btn" id="accentResetBtn" type="button">Reset</button>
      </div>
    </div>`;
}

export function wireAccentPicker(){
  const btn = document.getElementById('accentBtn');
  const panel = document.getElementById('accentPanel');
  if(!btn || !panel) return;
  panel.innerHTML = buildPanelHtml();

  const closePanel = ()=> panel.classList.remove('open');

  btn.addEventListener('click', (e)=>{
    e.stopPropagation();
    panel.classList.toggle('open');
  });
  panel.addEventListener('click', (e)=> e.stopPropagation());
  document.addEventListener('click', closePanel);

  panel.querySelectorAll('.accent-swatch').forEach(sw=>{
    sw.addEventListener('click', ()=>{
      saveAccent(sw.dataset.color);
      closePanel();
    });
  });
  document.getElementById('accentCustomInput')?.addEventListener('input', (e)=>{
    saveAccent(e.target.value);
  });
  document.getElementById('accentResetBtn')?.addEventListener('click', ()=>{
    saveAccent(DEFAULT_ACCENT);
    closePanel();
  });
}
