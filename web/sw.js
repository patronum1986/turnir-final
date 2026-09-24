// Only the public application shell is cached here. Personal data is an explicit,
// time-limited participant snapshot; protected media is downloaded to IndexedDB.
const CACHE='drakon-secure-shell-rf-20260924-sorting-1';
const SHELL=['/','/index.html','/app.js','/i18n.js','/english.js','/app-icons.js','/style.css','/manifest.json','/assets/favicon.png','/assets/apple-touch-icon.png','/assets/icon-192.png','/assets/icon-512.png',
'assets/fonts/montserrat-cyrillic-400-normal.woff2','assets/fonts/montserrat-cyrillic-600-normal.woff2','assets/fonts/montserrat-cyrillic-700-normal.woff2','assets/fonts/montserrat-latin-400-normal.woff2','assets/fonts/montserrat-latin-600-normal.woff2','assets/fonts/montserrat-latin-700-normal.woff2','assets/fonts/oswald-cyrillic-300-normal.woff2','assets/fonts/oswald-cyrillic-400-normal.woff2','assets/fonts/oswald-latin-300-normal.woff2','assets/fonts/oswald-latin-400-normal.woff2'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('drakon-secure-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
async function fetchWithDeadline(req){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
 try{return await fetch(req,{signal:controller.signal});}finally{clearTimeout(timer);}
}
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==location.origin)return;
 if(url.pathname==='/manifest.json'||/^\/assets\/(favicon|apple-touch-icon|icon-192|icon-512)\.png$/.test(url.pathname)){
  event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetchWithDeadline(req);if(response.ok){await cache.put(req,response.clone());await cache.put(url.pathname,response.clone());}return response;}catch{return (await cache.match(req))||(await cache.match(url.pathname))||Response.error();}})());return;
 }
 if(req.mode==='navigate'){event.respondWith(fetchWithDeadline(req).catch(()=>caches.match('/index.html')));return;}
 if(!SHELL.some(p=>new URL(p,self.location).pathname===url.pathname))return;
 event.respondWith(caches.match(req).then(hit=>hit||fetch(req)));
});
