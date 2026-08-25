/* -------------------------------- Skeletons -------------------------------- */
export function skeletonRows(n=4, cls=''){
  return `<div class="skel-wrap">${Array.from({length:n}).map(()=>`<div class="skel skel-row ${cls}"></div>`).join('')}</div>`;
}
export function skeletonCards(n=4){
  return `<div class="grid grid-2">${Array.from({length:n}).map(()=>`<div class="skel skel-row" style="height:64px;"></div>`).join('')}</div>`;
}
export function skeletonTable(n=6){
  return skeletonRows(n, 'sm');
}
