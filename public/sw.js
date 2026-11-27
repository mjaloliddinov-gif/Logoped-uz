// Minimal service worker: it only makes the site installable and shows a friendly page when the device is offline.
// It never caches pages, API responses, sign-in data or children's records.
const OFFLINE='/offline.html',CACHE='logoped-offline-v1';
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.add(OFFLINE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
 if(e.request.mode!=='navigate')return;
 e.respondWith(fetch(e.request).catch(()=>caches.match(OFFLINE)));
});
