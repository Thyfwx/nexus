// Nexus PWA service worker — register, force update check, auto-reload on takeover.
// Including this on a page guarantees the browser checks for SW updates whenever
// the user navigates there, instead of waiting up to 24 hours.
(function () {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/nexus/sw.js', { scope: '/nexus/' })
    .then(reg => {
      reg.update();
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            window.location.reload();
          }
        });
      });
    })
    .catch(e => console.warn('[PWA] SW registration failed:', e));
  let _swReloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (_swReloaded) return;
    _swReloaded = true;
    window.location.reload();
  });
})();
