import {authClient} from '../../../lib/supabase/server';
import {json,sameOrigin} from '../../../lib/server';
import {attemptAllowed} from '../../../lib/admin-security';
import {adminAuth,redeemCode,sha256} from '../../../lib/telegram';
export const dynamic='force-dynamic';
// Exchanges a one-time code from the Telegram bot for a normal Supabase session cookie.
export async function POST(req:Request){
 if(!sameOrigin(req))return json({error:'So‘rov manbasi rad etildi'},403);
 let b:any;try{const raw=await req.text();if(raw.length>200)return json({error:'So‘rov juda katta'},413);b=JSON.parse(raw)}catch{return json({error:'Noto‘g‘ri so‘rov'},400)}
 const code=typeof b?.code==='string'?b.code.replace(/\D/g,''):'';
 if(code.length!==6)return json({error:'6 xonali kodni kiriting'},400);
 try{
  const ip=(req.headers.get('x-forwarded-for')||'').split(',')[0].trim()||'unknown';
  if(!await attemptAllowed('tgip:'+(await sha256(ip)).slice(0,32)))return json({error:'Urinishlar ko‘p bo‘ldi. 15 daqiqadan keyin qayta urinib ko‘ring.',code:'rate_limited'},429);
  const user=await redeemCode(code);
  if(!user)return json({error:'Kod noto‘g‘ri yoki muddati tugagan. Telegram botdan yangi kod oling.',code:'invalid_code'},400);
  const link=await adminAuth().generateLink({type:'magiclink',email:user.email});
  const hashed=link.data?.properties?.hashed_token;if(!hashed||link.data?.user?.id!==user.id)throw Error('link_failed');
  const {error}=await (await authClient()).auth.verifyOtp({token_hash:hashed,type:'magiclink'});
  if(error)throw error;
  return json({ok:true});
 }catch(e){console.error('[auth/telegram]',e instanceof Error?e.name+': '+e.message.slice(0,40):'error');return json({error:'Kirish xizmati vaqtincha ishlamayapti. Birozdan keyin qayta urinib ko‘ring.',code:'service_unavailable'},503)}
}
