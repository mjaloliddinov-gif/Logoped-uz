import {authClient} from '../../../lib/supabase/server';
import {sameOrigin,json,database,audit} from '../../../lib/server';
import {cookie} from '../../../lib/admin-security';
import {AuthConfigError,siteOrigin} from '../../../lib/auth-config';
export const dynamic='force-dynamic';
const unavailable=()=>json({error:'Kirish xizmati vaqtincha ishlamayapti. Birozdan keyin qayta urinib ko‘ring.',code:'service_unavailable'},503);
// Logs go to the Vercel function logs: error names, codes and statuses only, never emails, passwords or tokens.
const brief=(e:any)=>e instanceof AuthConfigError?e.message:e instanceof Error?e.name+': '+e.message.slice(0,160):String(e?.code||e?.name||'unknown').slice(0,160);
const outage=(e:any)=>e?.name==='AuthRetryableFetchError'||Number(e?.status)>=500;
function signupFailure(e:any){
 const code=String(e?.code||''),status=Number(e?.status||0);
 if(code==='weak_password')return json({error:'Parol yetarlicha xavfsiz emas. Uzunroq va murakkabroq parol tanlang.',code},400);
 if(code==='over_email_send_rate_limit'||code==='over_request_rate_limit'||status===429)return json({error:'Juda ko‘p urinish bo‘ldi. Birozdan keyin qayta urinib ko‘ring.',code:'rate_limited'},429);
 if(code==='signup_disabled'||code==='email_provider_disabled')return json({error:'Ro‘yxatdan o‘tish hozircha o‘chirilgan.',code},503);
 if(code==='email_address_invalid'||code==='validation_failed')return json({error:'Bu email manzili qabul qilinmadi. Boshqa manzil bilan urinib ko‘ring.',code:'email_rejected'},400);
 if(e?.name==='AuthRetryableFetchError')return unavailable();
 // Supabase answers 5xx when it cannot send the confirmation email (custom SMTP missing or wrong).
 if(status>=500)return json({error:'Tasdiqlash emailini yuborib bo‘lmadi. Administrator Supabase’da SMTP sozlamasini tekshirsin.',code:'email_not_sent'},503);
 return json({error:'Ro‘yxatdan o‘tish amalga oshmadi. Keyinroq urinib ko‘ring.'},400);
}
export async function POST(req:Request){
 if(!sameOrigin(req))return json({error:'So‘rov manbasi rad etildi'},403);
 try{
  const raw=await req.text();if(raw.length>4000)return json({error:'So‘rov juda katta'},413);
  let b:any;try{b=JSON.parse(raw)}catch{return json({error:'Noto‘g‘ri so‘rov'},400)}
  if(!b||typeof b!=='object'||Array.isArray(b))return json({error:'Noto‘g‘ri so‘rov'},400);
  const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
  if(['login','signup','recover'].includes(b.action)&&(!/^\S+@\S+\.\S+$/.test(email)||email.length>200))return json({error:'To‘g‘ri email manzilini kiriting'},400);
  if(['login','signup','password'].includes(b.action)&&(typeof b.password!=='string'||b.password.length<12||b.password.length>128))return json({error:'Parol 12–128 belgidan iborat bo‘lsin'},400);
  if(b.action==='signup'&&(typeof b.name!=='string'||b.name.trim().length<2||b.name.length>80||!['parent','logoped'].includes(b.requestedRole)))return json({error:'Ism va rolni tanlang'},400);
  // Only emailed links need the site address; signing in must not depend on it.
  let origin='';
  if(['signup','recover'].includes(b.action)){
   const configured=siteOrigin(),current=new URL(req.url).origin;
   if(!configured)return json({error:'Sayt manzili sozlanmagan. Vercel’da NEXT_PUBLIC_SITE_URL ni to‘liq manzil (https://…) bilan kiriting va saytni qayta joylashtiring (Redeploy).',code:'site_url_missing'},503);
   if(configured!==current)return json({error:'Sayt manzili sozlamasi ('+configured+') joriy manzil ('+current+') bilan mos emas. NEXT_PUBLIC_SITE_URL ni to‘g‘rilang.',code:'site_url_mismatch'},503);
   origin=configured;
  }
  const client=await authClient();
  if(b.action==='login'){
   const {error}=await client.auth.signInWithPassword({email,password:b.password});
   if(error){
    if(outage(error)){console.error('[auth/login] provider unavailable:',error.name,error.status);return unavailable()}
    if((error as any).code==='email_not_confirmed')return json({error:'Email hali tasdiqlanmagan. Pochtangizdagi tasdiqlash havolasini oching.',code:'email_not_confirmed'},400);
    return json({error:'Email yoki parol noto‘g‘ri, yoxud email tasdiqlanmagan.'},400);
   }
   return json({ok:true});
  }
  if(b.action==='signup'){
   const {error}=await client.auth.signUp({email,password:b.password,options:{emailRedirectTo:origin+'/auth/confirm',data:{name:b.name.trim(),requestedRole:b.requestedRole}}});
   if(error){console.error('[auth/signup] rejected:',(error as any).code||error.name,error.status);return signupFailure(error)}
   return json({ok:true,message:'Emailingizdagi tasdiqlash havolasini oching. Keyin hisobga kiring.'});
  }
  if(b.action==='recover'){
   const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:origin+'/auth/confirm'});
   if(error)console.error('[auth/recover] not sent:',(error as any).code||error.name,error.status);
   return json({ok:true,message:'Hisob mavjud bo‘lsa, emailga tiklash havolasi yuboriladi.'});
  }
  if(b.action==='password'){const {data:{user},error}=await client.auth.getUser();if(error||!user)return json({error:'Tiklash havolasini email orqali oching'},401);const changed=await client.auth.updateUser({password:b.password});if(changed.error)return json({error:'Parolni yangilab bo‘lmadi'},400);await database().batch([database().prepare('DELETE FROM admin_grants WHERE owner=?').bind(user.id),audit(user.id,'password_changed',user.id)]);await client.auth.signOut({scope:'global'});return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':cookie('',0)}})}
  if(b.action==='logout'){const {data:{user}}=await client.auth.getUser();if(user)await database().prepare('DELETE FROM admin_grants WHERE owner=?').bind(user.id).run();await client.auth.signOut();return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':cookie('',0)}})}
  return json({error:'Noma’lum amal'},400);
 }catch(e){
  console.error('[auth/account]',brief(e));
  if(e instanceof AuthConfigError)return json({error:'Sayt hali to‘liq sozlanmagan. Administrator Vercel’dagi Supabase sozlamalarini (NEXT_PUBLIC_SUPABASE_URL va NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) tekshirib, saytni qayta joylashtirsin (Redeploy).',code:'not_configured'},503);
  return unavailable();
 }
}
