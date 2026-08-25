import { TOOLS } from './constants.js';
import { currentPath } from './router.js';

/* -------------------------------- Nav menu -------------------------------- */
export function buildNavMenu(){
  const menu = document.getElementById('navMenu');
  const path = currentPath();
  menu.innerHTML = `
    <button class="nav-close" id="navClose" aria-label="Close menu">✕</button>
    ${TOOLS.map(t=>`
    <a class="nav-item ${path===t.path?'active':''}" href="#${t.path}">
      <span class="ni-ico">${t.ico}</span>
      <span><span>${t.label}</span><span class="ni-sub">${t.sub}</span></span>
    </a>
  `).join('')}`;
  const closeBtn = document.getElementById('navClose');
  if(closeBtn) closeBtn.addEventListener('click', closeNavMenu);
}

export function closeNavMenu(){
  document.getElementById('navMenu').classList.remove('open');
  document.getElementById('navBackdrop').classList.remove('open');
}

export function wireNavTrigger(){
  const navTrigger = document.getElementById('navTrigger');
  navTrigger.addEventListener('click', (e)=>{
    e.stopPropagation();
    document.getElementById('navMenu').classList.toggle('open');
    document.getElementById('navBackdrop').classList.toggle('open');
  });
  document.getElementById('navBackdrop').addEventListener('click', closeNavMenu);
  document.addEventListener('click', closeNavMenu);
}
