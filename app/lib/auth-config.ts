// Environment validation. Only variable NAMES and problem types are ever reported; values never leave the server.
export type ConfigProblem={name:string;problem:'missing'|'invalid'|'insecure'|'secret_key_in_public_variable'};
const PLACEHOLDER=/YOUR_|example\.com|^<.*>$/i;
const LOCAL=['localhost','127.0.0.1','[::1]'];
/** Vercel values are often pasted with surrounding spaces, a trailing newline or quotes. */
export function envValue(raw:unknown):string{
 if(typeof raw!=='string')return '';
 let v=raw.trim();
 if(v.length>1&&((v[0]==='"'&&v[v.length-1]==='"')||(v[0]==="'"&&v[v.length-1]==="'")))v=v.slice(1,-1).trim();
 return v;
}
function parseUrl(v:string):URL|null{try{return new URL(v)}catch{return null}}
export function supabaseEnv(){
 const raw=envValue(process.env.NEXT_PUBLIC_SUPABASE_URL),parsed=raw?parseUrl(raw):null;
 // A pasted ".../rest/v1/" or trailing slash would break every auth request; the origin is always what the SDK needs.
 return {url:parsed?parsed.origin:raw,key:envValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)};
}
const SCHEME=/^[a-z][a-z0-9+.-]*:\/\//i;
function originOf(raw:unknown):string|null{
 let v=envValue(raw);if(!v||PLACEHOLDER.test(v))return null;
 // "my-site.vercel.app" without https:// is the most common way this variable is mistyped.
 if(!SCHEME.test(v)&&/^[a-z0-9.-]+(:\d+)?(\/.*)?$/i.test(v))v='https://'+v;
 const u=parseUrl(v);return u&&(u.protocol==='https:'||u.protocol==='http:')?u.origin:null;
}
/** The public address of the site. With fallback, Vercel's own production domain is used when the variable is missing or unusable. */
export function siteOrigin(raw:unknown=process.env.NEXT_PUBLIC_SITE_URL,fallback=true,env:Record<string,string|undefined>=process.env):string|null{
 const configured=originOf(raw);
 if(configured||!fallback)return configured;
 const host=envValue(env.VERCEL_PROJECT_PRODUCTION_URL);
 return host&&!SCHEME.test(host)?originOf('https://'+host):originOf(host);
}
function urlProblem(v:string):ConfigProblem['problem']|null{
 if(!v||PLACEHOLDER.test(v))return 'missing';
 const u=parseUrl(v);if(!u)return 'invalid';
 if(u.protocol!=='https:'&&!(u.protocol==='http:'&&LOCAL.includes(u.hostname)))return 'insecure';
 return null;
}
/** A service-role/secret key in a NEXT_PUBLIC_ variable would be shipped to every visitor's browser. */
function isSecretKey(key:string){
 if(key.startsWith('sb_secret_'))return true;
 const part=key.split('.')[1];if(!part)return false;
 try{return JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/'))).role==='service_role'}catch{return false}
}
export function supabaseProblems():ConfigProblem[]{
 const {url,key}=supabaseEnv(),out:ConfigProblem[]=[];
 const u=urlProblem(url);if(u)out.push({name:'NEXT_PUBLIC_SUPABASE_URL',problem:u});
 if(!key||PLACEHOLDER.test(key))out.push({name:'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',problem:'missing'});
 else if(isSecretKey(key))out.push({name:'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',problem:'secret_key_in_public_variable'});
 return out;
}
/** Everything the deployed site needs. Used by /api/health. */
export function allProblems():ConfigProblem[]{
 const out=supabaseProblems(),site=envValue(process.env.NEXT_PUBLIC_SITE_URL);
 if(!site||PLACEHOLDER.test(site))out.push({name:'NEXT_PUBLIC_SITE_URL',problem:'missing'});else if(!siteOrigin(site,false))out.push({name:'NEXT_PUBLIC_SITE_URL',problem:'invalid'});
 const db=envValue(process.env.DATABASE_URL);
 // Unencoded special characters in the password are the usual reason this fails to parse.
 if(!db||PLACEHOLDER.test(db))out.push({name:'DATABASE_URL',problem:'missing'});else if(!parseUrl(db))out.push({name:'DATABASE_URL',problem:'invalid'});
 const secret=envValue(process.env.SUPABASE_SECRET_KEY);if(!secret||PLACEHOLDER.test(secret))out.push({name:'SUPABASE_SECRET_KEY',problem:'missing'});
 const admin=envValue(process.env.ADMIN_EMAIL);if(!admin||PLACEHOLDER.test(admin))out.push({name:'ADMIN_EMAIL',problem:'missing'});else if(!/^\S+@\S+\.\S+$/.test(admin))out.push({name:'ADMIN_EMAIL',problem:'invalid'});
 return out;
}
export class AuthConfigError extends Error{
 constructor(public problems:ConfigProblem[]){super('Auth sozlamalari to‘liq emas: '+problems.map(p=>p.name+' ('+p.problem+')').join(', '));this.name='AuthConfigError'}
}
