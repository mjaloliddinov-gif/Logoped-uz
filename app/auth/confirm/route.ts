import {NextResponse} from 'next/server';
import {authClient} from '../../lib/supabase/server';
import {database} from '../../lib/postgres';
export const dynamic='force-dynamic';
type OtpType='signup'|'email'|'recovery'|'invite'|'magiclink'|'email_change';
const OTP_TYPES:OtpType[]=['signup','email','recovery','invite','magiclink','email_change'];
/** After the email is confirmed, the sign-up form data (name, role) is turned into a pending request, so the user does not have to fill the form twice. */
async function registerPending(user:any){
 const name=typeof user?.user_metadata?.name==='string'?user.user_metadata.name.trim().slice(0,80):'';
 const requestedRole=user?.user_metadata?.requestedRole;
 if(!user?.id||!user.email||name.length<2||!['parent','logoped'].includes(requestedRole))return;
 try{
  await database.batch([
   database.prepare('INSERT OR IGNORE INTO members VALUES (?,?,?)').bind(user.id,user.email,'pending'),
   database.prepare('INSERT OR IGNORE INTO settings VALUES (?,?)').bind('profile:'+user.id,JSON.stringify({name,requestedRole,submittedAt:new Date().toISOString()})),
   database.prepare('INSERT INTO audit VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),user.id,'registration_request',user.id,new Date().toISOString()),
  ]);
 }catch(e){console.error('[auth/confirm] pending request not saved:',e instanceof Error?e.name:'error')}
}
// Supports both link formats: the recommended ?token_hash=…&type=… template and Supabase's default {{ .ConfirmationURL }} (?code=…).
export async function GET(req:Request){
 const url=new URL(req.url),hash=url.searchParams.get('token_hash'),code=url.searchParams.get('code'),type=(url.searchParams.get('type')||'') as OtpType;
 const fail=(reason:string)=>NextResponse.redirect(new URL('/login?error='+reason,url.origin));
 if(url.searchParams.get('error_code')==='otp_expired')return fail('expired');
 try{
  const client=await authClient();
  let recovery=type==='recovery';
  if(hash&&OTP_TYPES.includes(type)){
   const {error}=await client.auth.verifyOtp({token_hash:hash,type});
   if(error){console.error('[auth/confirm] verifyOtp:',(error as any).code||error.name);return fail((error as any).code==='otp_expired'?'expired':'confirmation')}
  }else if(code){
   const {error}=await client.auth.exchangeCodeForSession(code);
   if(error){console.error('[auth/confirm] exchangeCode:',(error as any).code||error.name);return fail('confirmation')}
  }else return fail('confirmation');
  const {data:{user}}=await client.auth.getUser();
  // With the default template the type is not in the URL; the reset request adds next=/reset-password to its redirect.
  if(url.searchParams.get('next')==='/reset-password')recovery=true;
  if(recovery)return NextResponse.redirect(new URL('/reset-password',url.origin));
  await registerPending(user);
  return NextResponse.redirect(new URL('/signup?confirmed=1',url.origin));
 }catch(e){console.error('[auth/confirm]',e instanceof Error?e.name:'error');return fail('confirmation')}
}
