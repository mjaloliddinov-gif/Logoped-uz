import {identity,database as db,json,sameOrigin,audit} from '../../lib/server';
import {adminConfig,adminUnlocked,attemptAllowed,codeHash,equalHash,validCode,randomSecret,digest,cookie,GRANT_SECONDS} from '../../lib/admin-security';
export const dynamic='force-dynamic';
export async function GET(){try{const {member:m}=await identity({allowLockedAdmin:true});if(m.role!=='admin')return json({error:'Faqat administrator uchun'},403);return json({configured:!!await adminConfig(m.id),unlocked:await adminUnlocked(m.id)})}catch{return json({error:'Hisobga kiring'},401)}}
export async function POST(req:Request){
 if(!sameOrigin(req))return json({error:'So‘rov manbasi rad etildi'},403);
 let m:any;try{m=(await identity({allowLockedAdmin:true})).member}catch{return json({error:'Hisobga kiring'},401)}
 if(m.role!=='admin')return json({error:'Faqat administrator uchun'},403);
 try{
  const raw=await req.text();if(raw.length>2048)return json({error:'So‘rov juda katta'},413);const b=JSON.parse(raw);
  if(b.action==='lock'){await db().batch([db().prepare('DELETE FROM admin_grants WHERE owner=?').bind(m.id),audit(m.id,'admin_lock',m.id)]);return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':cookie('',0)}})}
  if(!['setup','unlock','change','recover'].includes(b.action))return json({error:'Noma’lum amal'},400);
  const config=await adminConfig(m.id);
  if(b.action==='setup'&&config)return json({error:'Kod allaqachon o‘rnatilgan'},409);
  if(b.action!=='setup'&&!config)return json({error:'Avval admin kodini yarating'},409);
  if(!await attemptAllowed(m.id))return json({error:'Urinishlar chegarasi tugadi. 15 daqiqadan keyin urinib ko‘ring.'},429);
  if(b.action==='unlock'||b.action==='change'){
   if(typeof b.code!=='string'||b.code.length>64||!equalHash(await codeHash(b.code,config.salt),config.hash)){await audit(m.id,'admin_code_failed',m.id).run();return json({error:'Kod noto‘g‘ri'},403)}
  }
  if(b.action==='recover'&&(typeof b.recovery!=='string'||b.recovery.length!==64||!equalHash(await digest(b.recovery),config.recoveryHash))){await audit(m.id,'admin_recovery_failed',m.id).run();return json({error:'Tiklash kaliti noto‘g‘ri'},403)}
  let recovery:string|undefined,updated=config;
  if(b.action!=='unlock'){
   if(!validCode(b.newCode))return json({error:'Kod 12–64 belgidan iborat bo‘lsin; bo‘sh joy ishlatmang.'},400);
   recovery=randomSecret();const salt=randomSecret();updated={salt,hash:await codeHash(b.newCode,salt),recoveryHash:await digest(recovery),version:randomSecret()};
   const statement=b.action==='setup'?db().prepare('INSERT OR IGNORE INTO settings VALUES (?,?)').bind('admin-code:'+m.id,JSON.stringify(updated)):db().prepare('UPDATE settings SET value=? WHERE id=? AND value=?').bind(JSON.stringify(updated),'admin-code:'+m.id,JSON.stringify(config));
   const change=await statement.run();if(!change.meta.changes)return json({error:'Kod o‘zgargan. Sahifani yangilang.'},409);
  }
  // Authorization grant is bound to the platform account and code version, never a replacement login.
  const token=randomSecret(),tokenHash=await digest(token);
  const results=await db().batch([
   db().prepare('DELETE FROM admin_grants WHERE expires<=? OR owner=?').bind(Date.now(),m.id),
   db().prepare('INSERT INTO admin_grants SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM settings WHERE id=? AND value=?)').bind(tokenHash,m.id,updated.version,Date.now()+GRANT_SECONDS*1000,'admin-code:'+m.id,JSON.stringify(updated)),
   audit(m.id,'admin_'+b.action,m.id)
  ]);
  if(!results[1].meta.changes)return json({error:'Kod o‘zgargan. Sahifani yangilang.'},409);
  return new Response(JSON.stringify({ok:true,...(recovery?{recovery}:{}),expiresIn:GRANT_SECONDS}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':cookie(token)}});
 }catch{return json({error:'Amal bajarilmadi. Qayta urinib ko‘ring.'},400)}
}
