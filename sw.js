/* Tổ giao dịch xã – lưu bản mở gần nhất để dùng khi mạng yếu hoặc mất mạng.
   Ưu tiên bản mới từ mạng; nếu mạng không trả lời trong 3 giây thì mở ngay bản đã lưu.
   Bản mới vẫn tải ngầm; tải xong mà khác bản đang mở thì báo cho trang để người dùng mở bản mới. */
const V='gdx-v3',WAIT=3000;
// mỗi trang chỉ lưu MỘT bản, bỏ đuôi ?v=… (trước đây mỗi ?v= là một bản riêng, dễ mở nhầm bản cũ)
const keyOf=r=>{const u=new URL(r.url);u.search='';u.hash='';if(r.mode==='navigate'&&u.pathname.endsWith('/'))u.pathname+='index.html';return u.href};
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(V).then(c=>c.addAll(['./index.html','./manifest.json','./icon-192.png','./icon-512.png']).catch(()=>{})))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
 let servedOld=null;
 const net=fetch(r,{cache:'no-cache'}).then(async res=>{if(res.ok){const cp=res.clone();
   if(servedOld&&r.mode==='navigate'){try{const [a,b]=await Promise.all([servedOld.clone().text(),res.clone().text()]);if(a!==b){const cs=await self.clients.matchAll({type:'window'});cs.forEach(c=>c.postMessage({t:'gdx-new'}))}}catch(x){}}
   await caches.open(V).then(c=>c.put(keyOf(r),cp))}return res});
 e.waitUntil(net.catch(()=>{}));
 const cached=()=>caches.match(keyOf(r)).then(m=>m||(r.mode==='navigate'?caches.match('./index.html'):undefined));
 e.respondWith(new Promise(done=>{let over=false;const fin=(x,old)=>{if(!over&&x){over=true;if(old)servedOld=x.clone();done(x)}};
  const tm=setTimeout(()=>cached().then(m=>fin(m,true)),WAIT);
  net.then(res=>{clearTimeout(tm);fin(res)}).catch(()=>{clearTimeout(tm);cached().then(m=>{if(m)fin(m,true);else if(!over){over=true;done(Response.error())}})});
 }))});
