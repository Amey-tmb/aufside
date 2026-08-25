/* -------------------------------- Utilities -------------------------------- */
export function esc(str){
  return String(str??'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}
export function timeUntil(iso){
  const diff = new Date(iso) - new Date();
  if(diff<=0) return 'deadline passed';
  const d = Math.floor(diff/86400000);
  const h = Math.floor((diff%86400000)/3600000);
  const m = Math.floor((diff%3600000)/60000);
  if(d>0) return `${d}d ${h}h`;
  if(h>0) return `${h}h ${m}m`;
  return `${m}m`;
}
export function fmtDate(iso){
  return new Date(iso).toLocaleString(undefined,{weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
}
export function gcalLink(title, details, startIso, durationMins=60){
  const start = new Date(startIso);
  const end = new Date(start.getTime()+durationMins*60000);
  const fmt = d=> d.toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
  const params = new URLSearchParams({
    action:'TEMPLATE', text:title, details, dates:`${fmt(start)}/${fmt(end)}`
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
