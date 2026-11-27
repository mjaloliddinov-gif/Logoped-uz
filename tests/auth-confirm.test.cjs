const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
let calls=[],otpError=null,codeError=null,user=null,batches=[],dbFail=false;
const client={auth:{verifyOtp:async b=>{calls.push(['otp',b]);return {error:otpError}},exchangeCodeForSession:async c=>{calls.push(['code',c]);return {error:codeError}},getUser:async()=>({data:{user}})}};
const database={prepare:t=>({text:t,bind(...v){this.values=v;return this}}),batch:async s=>{if(dbFail)throw Error('db');batches.push(s)}};
const NextResponse={redirect:u=>({status:307,location:String(u)})};
const src=ts.transpileModule(fs.readFileSync('app/auth/confirm/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
vm.runInNewContext('(function(require,module,exports){'+src+'})',{URL,Date,JSON,crypto,console:{error:()=>{}}})(n=>n==='next/server'?{NextResponse}:n.includes('supabase/server')?{authClient:async()=>client}:{database},mod,mod.exports);
const go=async q=>(await mod.exports.GET(new Request('https://test.local/auth/confirm'+q))).location;
let n=0;const ok=(a,b)=>{assert.equal(a,b);n++};
(async()=>{
 user={id:'u1',email:'p@test.local',user_metadata:{name:'Ali Valiyev',requestedRole:'parent'}};
 ok(await go('?token_hash=abc&type=email'),'https://test.local/signup?confirmed=1');
 ok(calls[0][0],'otp');ok(batches.length,1);ok(batches[0][0].values.join(),'u1,p@test.local,pending');
 ok(JSON.parse(batches[0][1].values[1]).requestedRole,'parent');
 // Supabase default template ({{ .ConfirmationURL }}) arrives as ?code=
 ok(await go('?code=xyz'),'https://test.local/signup?confirmed=1');ok(calls[1].join(),'code,xyz');
 ok(await go('?token_hash=abc&type=recovery'),'https://test.local/reset-password');
 ok(await go('?code=xyz&next=/reset-password'),'https://test.local/reset-password');
 // a role that is not allowed at sign-up is never registered
 batches=[];user={id:'u2',email:'x@test.local',user_metadata:{name:'X Y',requestedRole:'admin'}};await go('?code=q');ok(batches.length,0);
 // database trouble must not block the confirmed sign-in
 dbFail=true;user={id:'u3',email:'z@test.local',user_metadata:{name:'Zarina',requestedRole:'logoped'}};ok(await go('?code=q'),'https://test.local/signup?confirmed=1');dbFail=false;
 otpError={code:'otp_expired'};ok(await go('?token_hash=abc&type=email'),'https://test.local/login?error=expired');otpError=null;
 codeError={name:'AuthApiError'};ok(await go('?code=bad'),'https://test.local/login?error=confirmation');codeError=null;
 ok(await go('?token_hash=abc&type=evil'),'https://test.local/login?error=confirmation');
 ok(await go(''),'https://test.local/login?error=confirmation');
 ok(await go('?error=access_denied&error_code=otp_expired'),'https://test.local/login?error=expired');
 console.log(n+' email confirmation link checks passed');
})().catch(e=>{console.error(e);process.exit(1)});
