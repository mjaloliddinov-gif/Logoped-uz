import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {AuthConfigError,supabaseEnv,supabaseProblems} from '../auth-config';
export async function authClient(){
 const problems=supabaseProblems();if(problems.length)throw new AuthConfigError(problems);
 const {url,key}=supabaseEnv();
 const store=await cookies();
 return createServerClient(url,key,{cookieOptions:{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'},cookies:{getAll:()=>store.getAll(),setAll:(items)=>{try{items.forEach(({name,value,options})=>store.set(name,value,options))}catch{/* Server Component; proxy refreshes cookies. */}}}});
}
