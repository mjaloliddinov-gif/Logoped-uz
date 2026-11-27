import {json} from '../../lib/server';
import {allProblems,supabaseEnv} from '../../lib/auth-config';
import {database,caCertificates} from '../../lib/postgres';
export const dynamic='force-dynamic';
// Public diagnostics for the site owner. Reports variable NAMES and problem categories only, never values.
let cached:{at:number;result:any}|null=null;
function category(e:any){const m=String(e?.message||'')+' '+String(e?.code||'');
 if(/certificate|self.signed|SSL|TLS/i.test(m))return 'tls_certificate';
 if(/password authentication|authentication failed|SASL|28P01/i.test(m))return 'wrong_credentials';
 if(/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(m))return 'host_not_found';
 if(/timeout|ETIMEDOUT|ECONNREFUSED|ECONNRESET/i.test(m))return 'unreachable';
 if(/relation .* does not exist|schema .* does not exist|42P01|3F000/i.test(m))return 'tables_missing';
 return 'error'}
async function checkDatabase(){
 if(cached&&Date.now()-cached.at<30000)return cached.result;
 let result:any;
 const ca=caCertificates(process.env.DATABASE_CA_CERT).length;
 try{await database.prepare('SELECT 1 FROM members LIMIT 1').first();result={status:'ok'}}catch(e:any){
  // Only fixed error codes (e.g. SELF_SIGNED_CERT_IN_CHAIN) are reported, never messages that could contain hosts or users.
  const code=typeof e?.code==='string'&&/^[A-Z0-9_]{2,60}$/.test(e.code)?e.code:undefined;
  console.error('[health] database:',category(e),code);result={status:'error',reason:category(e),...(code?{code}:{}),caCertificates:ca};
 }
 cached={at:Date.now(),result};return result;
}
async function checkAuth(){
 const {url,key}=supabaseEnv();
 try{const r=await fetch(url+'/auth/v1/settings',{headers:{apikey:key},signal:AbortSignal.timeout(6000),cache:'no-store'});return r.ok?{status:'ok'}:{status:'error',reason:r.status===401||r.status===403?'key_rejected':'http_'+r.status}}
 catch{return {status:'error',reason:'unreachable'}}
}
export async function GET(req:Request){
 const problems=allProblems(),deep=new URL(req.url).searchParams.get('deep')==='1';
 const body:any={ok:problems.length===0,problems};
 if(deep){
  const authIssue=problems.some(p=>p.name.startsWith('NEXT_PUBLIC_SUPABASE'));
  body.auth=authIssue?{status:'skipped'}:await checkAuth();
  body.database=problems.some(p=>p.name==='DATABASE_URL')?{status:'skipped'}:await checkDatabase();
  body.ok=body.ok&&body.auth.status==='ok'&&body.database.status==='ok';
 }
 return json(body,body.ok?200:503);
}
