import { esc } from './utils.js';
import { fetchJSON } from './api.js';

/* -------------------------------- News feed -------------------------------- */
export async function fetchRSS(rssUrl){
  const data = await fetchJSON('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(rssUrl));
  if(data.status!=='ok') throw new Error('feed unavailable');
  return data.items.map(it=>({title:it.title, link:it.link, date:it.pubDate, source:'BBC Sport'}));
}

export function NewsCardHtml(it, emoji){
  return `
    <div class="card news-card">
      <div class="news-thumb">${emoji}</div>
      <div>
        <div class="news-title"><a href="${esc(it.link)}" target="_blank" rel="noopener">${esc(it.title)}</a></div>
        <div class="news-meta">${esc(it.source)} · ${it.date? new Date(it.date).toLocaleDateString(undefined,{month:'short',day:'numeric'}):''}</div>
      </div>
    </div>`;
}
