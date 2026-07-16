const CACHE='piano-notes-v1';
const ASSETS=['./','index.html','style.css','app.mjs','note-worklet.mjs','model.json','lib/dsp.mjs','lib/classifier.mjs','icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request))));
