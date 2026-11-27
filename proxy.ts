import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
import {supabaseEnv,supabaseProblems} from './app/lib/auth-config';
export async function proxy(request:NextRequest){
 let response=NextResponse.next({request});
 // Misconfigured or unreachable auth must never take the whole site down: pages and API routes report the problem themselves.
 if(supabaseProblems().length)return response;
 try{
  const {url,key}=supabaseEnv();
  const client=createServerClient(url,key,{cookieOptions:{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'},cookies:{getAll:()=>request.cookies.getAll(),setAll:(items)=>{items.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});items.forEach(({name,value,options})=>response.cookies.set(name,value,options));response.headers.set('Cache-Control','private, no-store')}}});
  await client.auth.getUser();
 }catch(e){console.error('[proxy] session refresh skipped:',e instanceof Error?e.name:'error')}
 return response;
}
export const config={matcher:['/api/:path*','/admin','/content','/auth/:path*','/login','/signup','/reset-password','/invite','/logout']};
