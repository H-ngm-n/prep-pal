const C='prep-pal-v10',F=['./','index.html','style.css','data.js','storage.js','providers.js','engine.js','onboarding.js','app.js','log.js','macros.js','myrecipes.js','manifest.json','icon-192.png','icon-512.png','prices.json'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(F)))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x))))));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==location.origin)return;
 if(u.pathname.endsWith('prices.json')){e.respondWith(fetch(e.request).then(r=>{const cl=r.clone();caches.open(C).then(c=>c.put(e.request,cl));return r}).catch(()=>caches.match(e.request)));return}
 e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});
