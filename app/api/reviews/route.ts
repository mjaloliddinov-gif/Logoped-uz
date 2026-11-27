import {identity,database as db,json,sameOrigin,audit} from '../../lib/server';
import {AdminLocked} from '../../lib/admin-security';
import {exercises,articles} from '../../lib/content';
export const dynamic='force-dynamic';
// Ratings and comments live in the generic `records` table (kind='review'), so no new SQL migration is needed.
const WRITERS=['admin','logoped','parent'];
const TARGET_KINDS=['exercise','article','video'];
const HOURLY_LIMIT=20,MAX_TEXT=600;
const demo=new Map<string,string>([...exercises,...articles].map((x:any):[string,string]=>[x.id,x.data.name]));
const id=(owner:string,target:string)=>'rv:'+owner+':'+target;
const parse=(r:any)=>{let data:any={};try{data=JSON.parse(r.data)}catch{}return {id:r.id,owner:r.owner,created:r.created,data}};
const clean=(v:unknown,n:number)=>String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim().slice(0,n);
const validRating=(v:unknown)=>Number.isInteger(v)&&(v as number)>=1&&(v as number)<=5;
function summarize(list:any[]){const distribution=[0,0,0,0,0];let sum=0;for(const r of list){const n=Number(r.data.rating);if(n>=1&&n<=5){distribution[n-1]++;sum+=n}}const count=distribution.reduce((a,b)=>a+b,0);return {count,average:count?Math.round(sum/count*10)/10:0,distribution}}
async function viewer(){try{return await identity()}catch(e){if(e instanceof AdminLocked)return null;return null}}
async function targetOk(target:string,admin:boolean){if(demo.has(target))return true;const row=await db().prepare('SELECT kind,data FROM records WHERE id=?').bind(target).first<any>();if(!row||!TARGET_KINDS.includes(row.kind))return false;let d:any={};try{d=JSON.parse(row.data)}catch{}return admin||d.published!==false}
async function displayName(m:any,u:any){let name='';try{const p=await db().prepare('SELECT value FROM settings WHERE id=?').bind('profile:'+m.id).first<any>();name=JSON.parse(p?.value||'{}').name||''}catch{}
 if(!name&&typeof u?.displayName==='string'&&!u.displayName.includes('@'))name=u.displayName;
 name=clean(name,60);if(!name)return 'Foydalanuvchi';const parts=name.split(' ');return parts[0].slice(0,24)+(parts[1]?' '+parts[1][0].toUpperCase()+'.':'')}
export async function GET(req:Request){try{
 const url=new URL(req.url),target=url.searchParams.get('target')||'';
 const rows=async(sql:string,...args:any[])=>(await db().prepare(sql).bind(...args).all<any>()).results.map(parse);
 if(url.searchParams.get('moderate')==='1'){
  let v;try{v=await identity()}catch(e){if(e instanceof AdminLocked)return json({error:'Admin kodini kiriting',code:'admin_locked'},423);return json({error:'Kirish talab qilinadi'},401)}
  if(v.member.role!=='admin')return json({error:'Ruxsat yo‘q'},403);
  const list=await rows("SELECT * FROM records WHERE kind='review' ORDER BY created DESC LIMIT 300");
  const names=new Map(demo);for(const r of await rows("SELECT * FROM records WHERE kind IN ('exercise','article','video')"))names.set(r.id,r.data.name||r.id);
  return json({reviews:list.map(r=>({id:r.id,target:r.data.target,targetName:names.get(r.data.target)||'O‘chirilgan material',rating:r.data.rating,text:r.data.text||'',name:r.data.name||'',hidden:r.data.hidden===true,created:r.created})),summary:summarize(list)});
 }
 if(url.searchParams.get('summary')==='1'){
  const list=(await rows("SELECT * FROM records WHERE kind='review' ORDER BY created DESC LIMIT 5000")).filter(r=>r.data.hidden!==true);
  const grouped:Record<string,any[]>={};for(const r of list)(grouped[r.data.target]??=[]).push(r);
  const out:Record<string,{count:number;average:number}>={};for(const [k,v] of Object.entries(grouped)){const s=summarize(v);out[k]={count:s.count,average:s.average}}
  return json({ratings:out});
 }
 if(!target||target.length>100)return json({error:'Material tanlanmagan'},400);
 const v=await viewer(),me=v?.member,admin=me?.role==='admin';
 if(!await targetOk(target,admin))return json({error:'Material topilmadi'},404);
 const list=await rows("SELECT * FROM records WHERE kind='review' AND json_extract(data,'$.target')=? ORDER BY created DESC LIMIT 200",target);
 const visible=list.filter(r=>r.data.hidden!==true),mine=me?list.find(r=>r.owner===me.id):null;
 return json({target,summary:summarize(visible),reviews:visible.slice(0,50).map(r=>({id:r.id,name:r.data.name||'Foydalanuvchi',rating:r.data.rating,text:r.data.text||'',created:r.data.updated||r.created,mine:!!me&&r.owner===me.id})),mine:mine?{id:mine.id,rating:mine.data.rating,text:mine.data.text||'',hidden:mine.data.hidden===true}:null,role:me?.role||null,canWrite:!!me&&WRITERS.includes(me.role)});
}catch{return json({error:'Sharhlarni yuklab bo‘lmadi. Qayta urinib ko‘ring.'},500)}}
export async function POST(req:Request){try{
 if(!sameOrigin(req))return json({error:'So‘rov manbasi rad etildi'},403);
 let v;try{v=await identity()}catch(e){if(e instanceof AdminLocked)return json({error:'Admin kodini kiriting',code:'admin_locked'},423);return json({error:'Sharh qoldirish uchun hisobingizga kiring.'},401)}
 const {user,member:m}=v,raw=await req.text();if(raw.length>4000)return json({error:'So‘rov juda katta'},413);
 let b:any;try{b=JSON.parse(raw)}catch{return json({error:'Noto‘g‘ri so‘rov'},400)}
 const now=new Date().toISOString();
 if(b.action==='save'){
  if(!WRITERS.includes(m.role))return json({error:'Sharh qoldirish uchun tasdiqlangan ota-ona, logoped yoki administrator hisobi kerak.'},403);
  const target=typeof b.target==='string'?b.target:'';if(!target||target.length>100||!await targetOk(target,m.role==='admin'))return json({error:'Material topilmadi'},404);
  if(!validRating(b.rating))return json({error:'1 dan 5 gacha baho tanlang.'},400);
  const text=clean(b.text,MAX_TEXT+1);if(text.length>MAX_TEXT)return json({error:'Sharh '+MAX_TEXT+' belgidan oshmasin.'},400);
  if(/https?:\/\/|www\./i.test(text))return json({error:'Sharhda havola qoldirib bo‘lmaydi.'},400);
  const since=new Date(Date.now()-3600000).toISOString();const used=await db().prepare("SELECT COUNT(*) AS n FROM audit WHERE actor=? AND action='review_save' AND created>?").bind(m.id,since).first<any>();
  if(Number(used?.n||0)>=HOURLY_LIMIT)return json({error:'Juda ko‘p sharh yuborildi. Birozdan keyin urinib ko‘ring.'},429);
  const rid=id(m.id,target),old=await db().prepare('SELECT * FROM records WHERE id=?').bind(rid).first<any>(),prev=old?parse(old).data:null;
  const data=JSON.stringify({target,rating:b.rating,text,name:await displayName(m,user),hidden:prev?.hidden===true,updated:now});
  await db().batch([db().prepare('INSERT INTO records VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind(rid,'review',m.id,null,data,now),audit(m.id,'review_save',target)]);
  return json({ok:true});
 }
 if(b.action==='delete'||b.action==='hide'){
  const row=typeof b.id==='string'?await db().prepare("SELECT * FROM records WHERE id=? AND kind='review'").bind(b.id).first<any>():null;
  if(!row)return json({error:'Sharh topilmadi'},404);
  if(b.action==='hide'){if(m.role!=='admin')return json({error:'Ruxsat yo‘q'},403);const r=parse(row);r.data.hidden=b.hidden===true;await db().batch([db().prepare('UPDATE records SET data=? WHERE id=?').bind(JSON.stringify(r.data),row.id),audit(m.id,r.data.hidden?'review_hide':'review_show',row.id)]);return json({ok:true})}
  if(m.role!=='admin'&&row.owner!==m.id)return json({error:'Ruxsat yo‘q'},403);
  await db().batch([db().prepare("DELETE FROM records WHERE id=? AND kind='review'").bind(row.id),audit(m.id,'review_delete',row.id)]);
  return json({ok:true});
 }
 return json({error:'Noma’lum amal'},400);
}catch{return json({error:'Saqlash amalga oshmadi. Qayta urinib ko‘ring.'},500)}}
