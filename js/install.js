/* ---- PWA install prompt ----
   Chrome/Edge/Android fire 'beforeinstallprompt' when the app is
   installable and not yet installed. We stash that event and reveal a
   button so the person can trigger the native install dialog on demand,
   instead of the browser's own (easy-to-miss) omnibox icon.
   iOS Safari doesn't support this event at all — there's no programmatic
   install prompt there, so the button simply never appears and users add
   it via the Share sheet's "Add to Home Screen" as usual.
*/
let deferredPrompt = null;

export function wireInstallPrompt(){
  const btn = document.getElementById('installBtn');
  if(!btn) return;

  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault();
    deferredPrompt = e;
    btn.hidden = false;
  });

  btn.addEventListener('click', async ()=>{
    if(!deferredPrompt) return;
    btn.hidden = true;
    deferredPrompt.prompt();
    try{ await deferredPrompt.userChoice; }catch(e){}
    deferredPrompt = null;
  });

  window.addEventListener('appinstalled', ()=>{
    btn.hidden = true;
    deferredPrompt = null;
  });
}
