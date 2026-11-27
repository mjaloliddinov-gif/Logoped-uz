const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
let calls=[],user={id:'verified-user'},failure=false,signupError=null,loginError=null,misconfigured=false,outageError=false;const client={auth:{getUser:async()=>({data:{user},error:null}),signInWithPassword:async b=>{calls.push(['login',b]);return {error:loginError||(failure?{}:null)}},signUp:async b=>{calls.push(['signup',b]);return {error:signupError||(failure?{}:null)}},resetPasswordForEmail:async (...b)=>{calls.push(['recover',...b]);return {}},resend:async b=>{calls.push(['resend',b]);return {error:null}},updateUser:async b=>{calls.push(['password',b]);return {error:null}},signOut:async b=>{calls.push(['logout',b]);return {error:null}}}};
const cfgMod={exports:{}};const cfgSource=ts.transpileModule(fs.readFileSync('app/lib/auth-config.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const cfgEnv={};vm.runInNewContext('(function(require,module,exports){'+cfgSource+'})',{URL,atob,process:{env:cfgEnv}})(()=>{throw Error('no imports expected')},cfgMod,cfgMod.exports);
const mod={exports:{}};const source=ts.transpileModule(fs.readFileSync('app/api/auth/account/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const routeEnv={NEXT_PUBLIC_SITE_URL:'https://test.local'};const logged=[];vm.runInNewContext('(function(require,module,exports){'+source+'})',{Response,Request,URL,console:{error:(...a)=>logged.push(a.join(' '))},process:{env:routeEnv}})(name=>name.includes('auth-config')?{AuthConfigError:cfgMod.exports.AuthConfigError,siteOrigin:()=>cfgMod.exports.siteOrigin(routeEnv.NEXT_PUBLIC_SITE_URL)}:name.includes('supabase/server')?{authClient:async()=>{if(misconfigured)throw new cfgMod.exports.AuthConfigError([{name:'NEXT_PUBLIC_SUPABASE_URL',problem:'missing'}]);if(outageError)throw new Error('fetch failed');return client}}:name.includes('admin-security')?{cookie:()=> 'admin=; Max-Age=0'}:{sameOrigin:r=>r.headers.get('origin')===new URL(r.url).origin,json:(b,status=200)=>Response.json(b,{status}),database:()=>({prepare:()=>({bind(){return this},run:async()=>{calls.push(['revoke']);return {}}}),batch:async()=>calls.push(['revoke'])}),audit:()=>({})},mod,mod.exports);
let count=0;async function post(body,status=200,origin='https://test.local'){const r=await mod.exports.POST(new Request('https://test.local/api/auth/account',{method:'POST',headers:{origin},body:JSON.stringify(body)}));assert.equal(r.status,status,await r.clone().text());count++;return r}
(async()=>{await post({action:'login',email:'parent@test.local',password:'Test-password-2026'},403,'https://evil.test');assert.equal(calls.length,0);count++;
await post({action:'signup',email:'parent@test.local',password:'Test-password-2026',name:'Test User',requestedRole:'admin'},400);assert.equal(calls.length,0);count++;
await post({action:'signup',email:'parent@test.local',password:'Test-password-2026',name:'Test User',requestedRole:'parent'});assert.equal(calls[0][1].options.data.requestedRole,'parent');count++;
await post({action:'login',email:'parent@test.local',password:'short'},400);await post({action:'login',email:'bad',password:'Test-password-2026'},400);
await post({action:'login',email:'parent@test.local',password:'Test-password-2026'});failure=true;await post({action:'login',email:'parent@test.local',password:'Test-password-2026'},400);failure=false;
await post({action:'recover',email:'missing@test.local'});user=null;await post({action:'password',password:'Changed-password-2026'},401);user={id:'verified-user'};await post({action:'password',password:'Changed-password-2026'});assert(calls.some(x=>x[0]==='revoke'));count++;
const signedout=await post({action:'logout'});assert(signedout.headers.get('set-cookie').includes('Max-Age=0'));count++;await post({action:'set-role'},400);

// --- diagnostics: each failure must say what is wrong instead of one generic message ---
const body=async(r)=>JSON.parse(await r.text());
const good={action:'login',email:'parent@test.local',password:'Test-password-2026'};
misconfigured=true;let r=await post(good,503);let d=await body(r);assert.equal(d.code,'not_configured');assert.ok(/Supabase/.test(d.error));assert.ok(logged.some(x=>x.includes('NEXT_PUBLIC_SUPABASE_URL')));assert.ok(!logged.join(' ').includes('Test-password-2026'),'passwords must never be logged');misconfigured=false;count+=2;
await post({action:'login',email:'bad',password:'x'},400);misconfigured=true;await post({action:'login',email:'bad',password:'x'},400);misconfigured=false; // input errors do not depend on configuration
outageError=true;d=await body(await post(good,503));assert.equal(d.code,'service_unavailable');outageError=false;count++;
const raw=await mod.exports.POST(new Request('https://test.local/api/auth/account',{method:'POST',headers:{origin:'https://test.local'},body:'not json'}));assert.equal(raw.status,400);count++;
loginError={code:'email_not_confirmed',status:400};d=await body(await post(good,400));assert.equal(d.code,'email_not_confirmed');loginError={name:'AuthRetryableFetchError',status:0};d=await body(await post(good,503));assert.equal(d.code,'service_unavailable');loginError=null;count++;
const sign={action:'signup',email:'parent@test.local',password:'Test-password-2026',name:'Test User',requestedRole:'parent'};
signupError={code:'over_email_send_rate_limit',status:429};d=await body(await post(sign,429));assert.equal(d.code,'rate_limited');
signupError={code:'weak_password',status:422};d=await body(await post(sign,400));assert.equal(d.code,'weak_password');
signupError={code:'unexpected_failure',status:500};d=await body(await post(sign,503));assert.equal(d.code,'email_not_sent');assert.ok(/SMTP/.test(d.error));
signupError={code:'user_already_exists',status:422};d=await body(await post(sign,400));assert.ok(!d.error.includes('mavjud'),'must not reveal whether an account exists');signupError=null;count++;
// site address: only emailed links (signup/recover) need it; sign-in keeps working
// a different configured address (www/apex, preview) no longer blocks sign-up; emailed links use the configured site, never the request host
routeEnv.NEXT_PUBLIC_SITE_URL='https://other.example';calls=[];await post(sign);assert.equal(calls.find(x=>x[0]==='signup')?.[1]?.options?.emailRedirectTo,'https://other.example/auth/confirm');
await post({action:'recover',email:'parent@test.local'});await post(good);
await post({action:'resend',email:'parent@test.local'});await post({action:'resend',email:'bad'},400);
routeEnv.NEXT_PUBLIC_SITE_URL='';d=await body(await post(sign,503));assert.equal(d.code,'site_url_missing');
routeEnv.NEXT_PUBLIC_SITE_URL='  "https://test.local/"  ';await post(sign);routeEnv.NEXT_PUBLIC_SITE_URL='https://test.local';count+=3;
// configuration validator (names/categories only)
const cfg=cfgMod.exports;const names=l=>Array.from(l,p=>p.name+':'+p.problem).sort().join(',');
Object.assign(cfgEnv,{NEXT_PUBLIC_SUPABASE_URL:'"https://abc.supabase.co/rest/v1/"\n',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:' sb_publishable_abc \n'});
assert.equal(names(cfg.supabaseProblems()),'');assert.equal(cfg.supabaseEnv().url,'https://abc.supabase.co');assert.equal(cfg.supabaseEnv().key,'sb_publishable_abc');
cfgEnv.NEXT_PUBLIC_SUPABASE_URL='abc.supabase.co';assert.equal(names(cfg.supabaseProblems()),'NEXT_PUBLIC_SUPABASE_URL:invalid');
cfgEnv.NEXT_PUBLIC_SUPABASE_URL='http://abc.supabase.co';assert.equal(cfg.supabaseProblems()[0].problem,'insecure');
cfgEnv.NEXT_PUBLIC_SUPABASE_URL='https://YOUR_PROJECT.supabase.co';assert.equal(cfg.supabaseProblems()[0].problem,'missing');
cfgEnv.NEXT_PUBLIC_SUPABASE_URL='https://abc.supabase.co';cfgEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_secret_leaked';assert.equal(cfg.supabaseProblems()[0].problem,'secret_key_in_public_variable');
const jwt=role=>'x.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.y';
cfgEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=jwt('service_role');assert.equal(cfg.supabaseProblems()[0].problem,'secret_key_in_public_variable');cfgEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=jwt('anon');assert.equal(names(cfg.supabaseProblems()),'');
cfgEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='';assert.equal(cfg.supabaseProblems()[0].problem,'missing');
assert.equal(cfg.siteOrigin('https://x.vercel.app/'),'https://x.vercel.app');assert.equal(cfg.siteOrigin('x.vercel.app'),'https://x.vercel.app');assert.equal(cfg.siteOrigin('  "Logoped.UZ/path"\n'),'https://logoped.uz');assert.equal(cfg.siteOrigin('not a host!'),null);assert.equal(cfg.siteOrigin('',true,{VERCEL_PROJECT_PRODUCTION_URL:'logoped-uz.vercel.app'}),'https://logoped-uz.vercel.app');assert.equal(cfg.siteOrigin('',false,{VERCEL_PROJECT_PRODUCTION_URL:'logoped-uz.vercel.app'}),null);assert.equal(cfg.siteOrigin('https://own.example',true,{VERCEL_PROJECT_PRODUCTION_URL:'logoped-uz.vercel.app'}),'https://own.example');assert.equal(cfg.siteOrigin('',true,{}),null);assert.equal(cfg.siteOrigin(undefined),null);assert.equal(cfg.siteOrigin('ftp://x'),null);
Object.assign(cfgEnv,{NEXT_PUBLIC_SITE_URL:'https://x.vercel.app',DATABASE_URL:'postgresql://u:p@ss@word@h:6543/postgres',SUPABASE_SECRET_KEY:'k',ADMIN_EMAIL:'me@x.uz',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_abc'});
assert.ok(!cfg.allProblems().some(p=>p.name==='DATABASE_URL'),'URL parser accepts this; the DB driver gets the raw value');
cfgEnv.DATABASE_URL='';cfgEnv.ADMIN_EMAIL='not-an-email';assert.equal(names(cfg.allProblems()),'ADMIN_EMAIL:invalid,DATABASE_URL:missing');
assert.ok(!JSON.stringify(cfg.allProblems()).includes('sb_publishable'),'values must not appear in reports');count+=12;
console.log(`${count} email auth validation, role, CSRF and reset checks passed`);
})().catch(e=>{console.error(e);process.exit(1)});
