const scope=new URL(self.registration.scope);
const prefix='marvel-pwa:'+scope.pathname+':';
const shellCache=prefix+'shell-__PAGES_REVISION__';
const imageCache=prefix+'images';
const shell=[
  'index.html','manifest.webmanifest','icon-192.png','icon-512.png','catalog.json',
  'styles.css','layout.css','theme-light.css','app.mjs','model.mjs','catalog.mjs',
  'groups.mjs','artwork.mjs','icons.mjs','auxiliaries.mjs','construction.mjs',
  'statistics.mjs','filter-presets.mjs','simulator.mjs','ally-filters.mjs',
  'detail-navigation.mjs','card-presentation.mjs','collection-cycles.mjs',
].map(file=>new URL(file,scope).href);
const shellFiles=new Set(shell);

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(shellCache).then(cache=>cache.addAll(shell.map(url=>new Request(url,{cache:'reload'})))));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys()){
      if(key.startsWith(prefix+'shell-')&&key!==shellCache)await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const {request}=event;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  const home=request.mode==='navigate'&&(url.pathname===scope.pathname||url.href===shell[0]);
  if(home||shellFiles.has(url.href)){
    event.respondWith((async()=>{
      const cache=await caches.open(shellCache);
      return await cache.match(home?shell[0]:request)||fetch(request);
    })());
  }else if(request.destination==='image'&&url.pathname.startsWith(scope.pathname+'assets/')){
    event.respondWith((async()=>{
      const cache=await caches.open(imageCache);
      const saved=await cache.match(request);
      if(saved)return saved;
      const response=await fetch(request);
      if(response.ok)try{await cache.put(request,response.clone());}catch{/* La imagen sigue disponible en línea. */}
      return response;
    })());
  }
});
