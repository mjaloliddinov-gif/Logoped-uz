import {env} from './runtime';
import {adminUnlocked,AdminLocked} from './admin-security';
import {getAppUser} from '../app-auth';
export const database=()=>env.DB!;
export const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function identity(options:{allowLockedAdmin?:boolean}={}){const user=await getAppUser();if(!user)throw new Error('Kirish talab qilinadi');const [found,care]=await Promise.all([database().prepare('SELECT * FROM members WHERE id=?').bind(user.userId).first<any>(),database().prepare('SELECT value FROM settings WHERE id=?').bind('care:'+user.userId).first<any>()]);if(found?.role==='admin'&&!options.allowLockedAdmin&&!await adminUnlocked(user.userId))throw new AdminLocked();return {user,member:{...(found??{id:user.userId,email:user.email,role:'pending'}),care:care?.value==='true'}}}
export async function records(){const r=await database().prepare('SELECT * FROM records ORDER BY created DESC').all<any>();return r.results.map(r=>({...r,data:JSON.parse(r.data)}))}
const hostOf=(v:unknown)=>{const t=String(v??'').split(',')[0].trim().replace(/^["']|["']$/g,'');if(!t)return '';try{return new URL(t.includes('://')?t:'https://'+t).host.toLowerCase()}catch{return ''}};
// Hosts that legitimately serve this site. Browsers set Host/Origin themselves and a web page cannot forge them,
// so a request from another website never matches. Vercel may expose a different internal host in req.url
// (custom domain, www, branch alias), which is why req.url alone is not enough.
function trustedHosts(req:Request){
 const hosts=new Set<string>(),env:Record<string,string|undefined>=typeof process!=='undefined'?process.env:{};
 for(const v of [new URL(req.url).host,req.headers.get('host'),req.headers.get('x-forwarded-host'),env.NEXT_PUBLIC_SITE_URL,env.VERCEL_URL,env.VERCEL_BRANCH_URL,env.VERCEL_PROJECT_PRODUCTION_URL]){const h=hostOf(v);if(h)hosts.add(h)}
 return hosts;
}
export function sameOrigin(req:Request){
 const origin=req.headers.get('origin');
 if(origin&&origin!=='null'){
  let o:URL;try{o=new URL(origin)}catch{return false}
  const local=['localhost','127.0.0.1','[::1]'].includes(o.hostname);
  if(o.protocol!=='https:'&&!(o.protocol==='http:'&&local))return false;
  if(o.origin===new URL(req.url).origin)return true;
  const hosts=trustedHosts(req);
  if(hosts.has(o.host.toLowerCase()))return true;
  console.error('[origin] rejected:',o.host,'| trusted hosts:',Array.from(hosts).join(', '));
  return false;
 }
 // Origin is missing or "null" after some redirects and in a few in-app browsers; Sec-Fetch-Site is set by the browser itself.
 return req.headers.get('sec-fetch-site')==='same-origin';
}
export function audit(actor:string,action:string,target:string){return database().prepare('INSERT INTO audit VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),actor,action,target,new Date().toISOString())}
