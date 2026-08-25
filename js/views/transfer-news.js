import { esc } from '../utils.js';
import { skeletonRows } from '../skeletons.js';
import { ToolShell } from '../tool-shell.js';
import { fetchRSS, NewsCardHtml } from '../news.js';
import { renderRoot } from '../app.js';

/* ---- Transfer News (real-world) ---- */
export async function TransferNewsView(){
  renderRoot(ToolShell('Transfer News','Real-world Premier League transfer headlines, filtered from the BBC Sport football feed.', skeletonRows(5)));
  try{
    const feed = await fetchRSS('https://feeds.bbci.co.uk/sport/football/rss.xml');
    const keywords = /(sign|transfer|deal|move to|joins|loan|medical|fee agreed|here we go)/i;
    const items = feed.filter(it=>keywords.test(it.title)).slice(0,20);
    const body = items.length===0 ? `<div class="empty-box">No transfer-flavoured headlines in the feed right now — check the general news feed instead.</div>` : `
      <div class="grid grid-2">
        ${items.map(it=>NewsCardHtml(it,'🔁')).join('')}
      </div>`;
    renderRoot(ToolShell('Transfer News','Real-world Premier League transfer headlines, filtered from the BBC Sport football feed.', body));
  }catch(e){
    renderRoot(ToolShell('Transfer News','Real-world Premier League transfer headlines, filtered from the BBC Sport football feed.', `<div class="err-box">Could not load the news feed (${esc(e.message)}). The RSS proxy may be temporarily unavailable.</div>`));
  }
}
