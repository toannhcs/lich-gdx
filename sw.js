/* Tổ giao dịch xã – lưu bản mở gần nhất để dùng khi mạng yếu hoặc mất mạng.
   Ưu tiên bản mới từ mạng; nếu mạng không trả lời trong 3 giây thì mở ngay bản đã lưu
   (bản mới vẫn tải ngầm và dùng cho lần mở sau). */
const V='gdx-v2',WAIT=3000;
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(V).then(c=>c.addAll(['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png']).catch(()=>{})))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
 const net=fetch(r,{cache:'no-cache'}).then(res=>{if(res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp))}return res});
 e.waitUntil(net.catch(()=>{}));
 const cached=()=>caches.match(r,{ignoreSearch:true}).then(m=>m||(r.mode==='navigate'?caches.match('./index.html'):undefined));
 e.respondWith(new Promise(done=>{let over=false;const fin=x=>{if(!over&&x){over=true;done(x)}};
  const tm=setTimeout(()=>cached().then(fin),WAIT);
  net.then(res=>{clearTimeout(tm);fin(res)}).catch(()=>{clearTimeout(tm);cached().then(m=>{if(m)fin(m);else if(!over){over=true;done(Response.error())}})});
 }))});
