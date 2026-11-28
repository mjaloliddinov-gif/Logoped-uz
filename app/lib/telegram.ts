import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {envValue,supabaseEnv} from './auth-config';
import {database} from './postgres';
// Parents register through the Telegram bot and sign in on the site with a short one-time code.
export const CODE_MINUTES=10;
export const botToken=()=>envValue(process.env.TELEGRAM_BOT_TOKEN);
export const webhookSecret=()=>envValue(process.env.TELEGRAM_WEBHOOK_SECRET);
export const telegramEmail=(telegramId:number|string)=>'tg'+String(telegramId).replace(/\D/g,'')+'@telegram.logoped.uz';
export async function sha256(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('')}
export function equalText(a:string,b:string){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}
export function randomCode(){const n=crypto.getRandomValues(new Uint32Array(1))[0]%1000000;return String(n).padStart(6,'0')}
export async function telegram(method:string,body:Record<string,unknown>){
 const token=botToken();if(!token)throw Error('telegram_not_configured');
 const r=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
 const d:any=await r.json().catch(()=>null);if(!d?.ok)throw Error('telegram_'+method+'_failed');return d.result;
}
export function adminAuth(){
 const {url}=supabaseEnv(),key=envValue(process.env.SUPABASE_SECRET_KEY);if(!url||!key)throw Error('supabase_admin_not_configured');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}).auth.admin;
}
const db=database;
export async function setting(id:string){const r=await db.prepare('SELECT value FROM settings WHERE id=?').bind(id).first<{value:string}>();return r?JSON.parse(r.value):null}
export const putSetting=(id:string,value:unknown)=>db.prepare('INSERT INTO settings VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').bind(id,JSON.stringify(value));
export const dropSetting=(id:string)=>db.prepare('DELETE FROM settings WHERE id=?').bind(id);
/** Issues a fresh single-use code for an account, replacing any earlier one. */
export async function issueCode(user:{id:string;email:string}){
 const expires=Date.now()+CODE_MINUTES*60000;
 await db.prepare("DELETE FROM settings WHERE id LIKE 'tgcode:%' AND CAST(json_extract(value,'$.expires') AS bigint)<?").bind(Date.now()).run();
 const previous=await setting('tgcodeof:'+user.id);
 for(let i=0;i<5;i++){
  const code=randomCode(),hash=await sha256(code);
  const r=await db.prepare('INSERT OR IGNORE INTO settings VALUES (?,?)').bind('tgcode:'+hash,JSON.stringify({user:user.id,email:user.email,expires})).run();
  if(!r.meta.changes)continue;
  await db.batch([...(previous?.hash?[dropSetting('tgcode:'+previous.hash)]:[]),putSetting('tgcodeof:'+user.id,{hash})]);
  return code;
 }
 throw Error('code_not_issued');
}
/** Returns the account for a valid code and burns the code. */
export async function redeemCode(code:string){
 const hash=await sha256(code),id='tgcode:'+hash,found=await setting(id);
 if(!found)return null;
 const removed=await dropSetting(id).run();if(!removed.meta.changes)return null;
 if(Number(found.expires)<Date.now())return null;
 return {id:String(found.user),email:String(found.email)};
}
export async function botUsername():Promise<string|null>{try{return (await setting('telegram_bot'))?.username||null}catch{return null}}
