import {NextResponse} from 'next/server';
import {authClient} from '../../lib/supabase/server';
export const dynamic='force-dynamic';
export async function GET(req:Request){const url=new URL(req.url),hash=url.searchParams.get('token_hash'),type=url.searchParams.get('type');if(hash&&['signup','email','recovery'].includes(type||'')){try{const client=await authClient();const {error}=await client.auth.verifyOtp({token_hash:hash,type:type as 'signup'|'email'|'recovery'});if(!error)return NextResponse.redirect(new URL(type==='recovery'?'/reset-password':'/signup',url.origin))}catch{}}return NextResponse.redirect(new URL('/login?error=confirmation',url.origin))}
