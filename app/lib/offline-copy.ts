// Builds a single self-contained .html copy of the PUBLIC home page.
// It is rebuilt from the server-rendered markup fetched without cookies, so nothing from a signed-in session
// (children's names, grades, chat) can ever end up in the downloaded file.
const MAX_ASSET=3_500_000,MAX_TOTAL=9_000_000;
const IMAGE=/\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i;
type Fetcher=(url:string,init?:RequestInit)=>Promise<Response>;
export interface OfflineOptions{origin:string;fetcher?:Fetcher;theme?:string;now?:Date;parse?:(html:string)=>Document}
export async function buildOfflineHtml(o:OfflineOptions):Promise<string>{
 const f:Fetcher=o.fetcher||((u,i)=>fetch(u,i)),origin=o.origin.replace(/\/$/,''),base=origin+'/';
 const res=await f(base,{credentials:'omit',cache:'no-store'});
 if(!res.ok)throw new Error('home '+res.status);
 const doc=(o.parse||(h=>new DOMParser().parseFromString(h,'text/html')))(await res.text());
 const budget={left:MAX_TOTAL},seen=new Map<string,string>();
 const abs=(u:string,from=base)=>{try{return new URL(u,from).href}catch{return u}};
 const sameOrigin=(u:string)=>{try{return new URL(u).origin===origin}catch{return false}};
 async function embed(url:string):Promise<string>{
  // Only same-origin images are embedded (size-capped); anything else stays an absolute link.
  if(seen.has(url))return seen.get(url)!;
  let out=url;
  if(sameOrigin(url)){try{
   const r=await f(url,{credentials:'omit'});
   if(r.ok){const blob=await r.blob();
    if(blob.type.startsWith('image/')&&blob.size<=MAX_ASSET&&blob.size<=budget.left){budget.left-=blob.size;out=await new Promise<string>((ok,no)=>{const fr=new FileReader();fr.onload=()=>ok(String(fr.result));fr.onerror=()=>no(fr.error);fr.readAsDataURL(blob)})}}
  }catch{}}
  seen.set(url,out);return out;
 }
 async function css(text:string,from:string){
  const refs=new Set<string>();text.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g,(m,q,u)=>{if(!/^(data:|#)/i.test(u))refs.add(u);return m});
  const map=new Map<string,string>();
  for(const u of refs){const a=abs(u,from);map.set(u,IMAGE.test(a)?await embed(a):a)}
  return text.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g,(m,q,u)=>map.has(u)?'url("'+map.get(u)+'")':m);
 }
 let styles='';
 for(const link of Array.from(doc.querySelectorAll('link[rel~="stylesheet"]'))){
  const href=abs(link.getAttribute('href')||'');
  if(sameOrigin(href)){try{const r=await f(href,{credentials:'omit'});if(r.ok)styles+=await css(await r.text(),href)+'\n'}catch{}}
  link.remove();
 }
 for(const s of Array.from(doc.querySelectorAll('style'))){s.textContent=await css(s.textContent||'',base)}
 doc.querySelectorAll('script,noscript,link[rel~="preload"],link[rel~="modulepreload"],link[rel~="prefetch"],link[rel="manifest"],meta[http-equiv]').forEach(n=>n.remove());
 doc.querySelectorAll('*').forEach(el=>{for(const a of Array.from(el.attributes))if(/^on/i.test(a.name))el.removeAttribute(a.name)});
 for(const img of Array.from(doc.querySelectorAll('img'))){
  const src=img.getAttribute('src');if(!src||src.startsWith('data:'))continue;
  img.setAttribute('src',await embed(abs(src)));img.removeAttribute('srcset');img.removeAttribute('loading');
 }
 doc.querySelectorAll('link[rel~="icon"],link[rel="apple-touch-icon"]').forEach(l=>l.setAttribute('href',abs(l.getAttribute('href')||'')));
 doc.querySelectorAll('a[href]').forEach(a=>{
  const h=a.getAttribute('href')||'';
  if(/^javascript:/i.test(h)){a.removeAttribute('href');return}
  if(h.startsWith('#')||/^(mailto:|tel:)/i.test(h))return;
  a.setAttribute('href',abs(h));a.setAttribute('target','_blank');a.setAttribute('rel','noopener noreferrer');
 });
 const head=doc.head||doc.documentElement.insertBefore(doc.createElement('head'),doc.body);
 const csp=doc.createElement('meta');csp.setAttribute('http-equiv','Content-Security-Policy');csp.setAttribute('content',"default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; font-src data: https:; frame-src https://www.youtube-nocookie.com; base-uri 'none'; form-action 'none'");head.prepend(csp);
 const style=doc.createElement('style');style.textContent=styles;head.append(style);
 if(o.theme==='dark'||o.theme==='light')doc.documentElement.setAttribute('data-theme',o.theme);
 const date=(o.now||new Date()).toISOString().slice(0,10),banner=doc.createElement('div');
 banner.setAttribute('style','position:sticky;top:0;z-index:9999;background:#34785c;color:#fff;font:14px/1.5 Arial,sans-serif;padding:10px 16px;text-align:center');
 banner.textContent='LOGOPED.UZ oflayn nusxa · '+date+' · Kirish, chat va baholar uchun saytni internetda oching: ';
 const link=doc.createElement('a');link.setAttribute('href',origin);link.setAttribute('style','color:#fff;font-weight:700;text-decoration:underline');link.textContent=origin.replace(/^https?:\/\//,'');banner.append(link);
 doc.body.prepend(banner);
 return '<!doctype html>\n'+doc.documentElement.outerHTML;
}
export function offlineFileName(now=new Date()){return 'logoped-uz-'+now.toISOString().slice(0,10)+'.html'}
