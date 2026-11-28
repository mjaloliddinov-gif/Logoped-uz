// Telegram registration and one-time code sign-in, with Telegram, Supabase and the database replaced by fakes.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const load=(file,mods,extra={})=>{const m={exports:{}};const src=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext('(function(require,module,exports){'+src+'})',{URL,Date,JSON,crypto,TextEncoder,Uint8Array,Uint32Array,Array,String,Number,Error,Response,Request,AbortSignal,console:{error:()=>{}},process:{env},...extra})(n=>{for(const k of Object.keys(mods))if(n.includes(k))return mods[k];throw Error('unexpected require '+n)},m,m.exports);return m.exports};
const env={TELEGRAM_BOT_TOKEN:'123:abc',TELEGRAM_WEBHOOK_SECRET:'s3cret-value',NEXT_PUBLIC_SITE_URL:'https://site.test',NEXT_PUBLIC_SUPABASE_URL:'https://x.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_x',SUPABASE_SECRET_KEY:'sb_secret_x'};
// --- fake database (only the statements these modules use) ---
const settings=new Map(),members=new Map(),audit=[];
function exec(text,v){
 if(text==='SELECT value FROM settings WHERE id=?')return {rows:settings.has(v[0])?[{value:settings.get(v[0])}]:[]};
 if(text.startsWith("DELETE FROM settings WHERE id LIKE 'tgcode:%'")){let n=0;for(const [k,val] of settings)if(k.startsWith('tgcode:')&&JSON.parse(val).expires<v[0]){settings.delete(k);n++}return {rows:[],rowCount:n}}
 if(text==='INSERT OR IGNORE INTO settings VALUES (?,?)'){if(settings.has(v[0]))return {rows:[],rowCount:0};settings.set(v[0],v[1]);return {rows:[],rowCount:1}}
 if(text.startsWith('INSERT INTO settings VALUES (?,?) ON CONFLICT')){settings.set(v[0],v[1]);return {rows:[],rowCount:1}}
 if(text==='DELETE FROM settings WHERE id=?'){const had=settings.delete(v[0]);return {rows:[],rowCount:had?1:0}}
 if(text.startsWith("INSERT INTO members VALUES (?,?,'parent')")){if(!members.has(v[0]))members.set(v[0],{email:v[1],role:'parent'});return {rows:[],rowCount:1}}
 if(text.startsWith('INSERT INTO audit')){audit.push(v);return {rows:[],rowCount:1}}
 throw Error('unexpected SQL '+text);
}
const st=(text)=>({text,values:[],bind(...v){this.values=v;return this},async first(){return exec(text,this.values).rows[0]??null},async run(){return {meta:{changes:exec(text,this.values).rowCount}}}});
const database={prepare:st,async batch(list){return list.map(s=>({meta:{changes:exec(s.text,s.values).rowCount}}))}};
// --- fake Telegram + Supabase ---
const sent=[];const fetch=async(url,init)=>{const body=JSON.parse(init.body);sent.push({method:url.split('/').pop(),body});return {json:async()=>({ok:true,result:url.endsWith('getMe')?{username:'logoped_test_bot'}:true})}};
const users=new Map();let verified=[];
const admin={createUser:async({email,user_metadata})=>{if([...users.values()].some(u=>u.email===email))return {data:{user:null},error:{code:'email_exists'}};const id='u'+(users.size+1);users.set(id,{id,email,user_metadata});return {data:{user:{id,email}},error:null}},
 generateLink:async({email})=>{const u=[...users.values()].find(x=>x.email===email);return {data:{user:u?{id:u.id}:null,properties:{hashed_token:'h-'+(u&&u.id)}}}}};
const supabase={createClient:()=>({auth:{admin}})};
const config=load('app/lib/auth-config.ts',{});
const tg=load('app/lib/telegram.ts',{'server-only':{},'supabase-js':supabase,'auth-config':config,'./postgres':{database}},{fetch});
const json=(d,s=200)=>Response.json(d,{status:s});
const webhook=load('app/api/telegram/webhook/route.ts',{'lib/postgres':{database},'lib/auth-config':config,'lib/telegram':tg},{fetch});
let attempts=0;const login=load('app/api/auth/telegram/route.ts',{'supabase/server':{authClient:async()=>({auth:{verifyOtp:async b=>{verified.push(b);return {error:null}}}})},'lib/server':{json,sameOrigin:()=>true},'admin-security':{attemptAllowed:async()=>++attempts<=50},'lib/telegram':tg});
let n=0;const ok=(a,b,m)=>{assert.equal(a,b,m);n++};
const update=(msg,secret='s3cret-value')=>webhook.POST(new Request('https://site.test/api/telegram/webhook',{method:'POST',headers:{'x-telegram-bot-api-secret-token':secret},body:JSON.stringify({message:{chat:{id:77,type:'private'},from:{id:77,username:'ona'},...msg}})}));
const last=()=>sent[sent.length-1].body.text;
const codeFrom=t=>(t.match(/<b>(\d{6})<\/b>/)||[])[1];
const signIn=async code=>(await login.POST(new Request('https://site.test/api/auth/telegram',{method:'POST',body:JSON.stringify({code})}))).status;
(async()=>{
 ok((await update({text:'/start'},'wrong')).status,403,'webhook rejects a wrong secret');ok(sent.length,0);
 await update({text:'/start'});assert.match(last(),/ismingiz va familiyangizni/);n++;
 await update({text:'A'});assert.match(last(),/matn bilan yozing/);n++;
 await update({text:'Dilnoza Karimova'});assert.match(last(),/telefon raqamingizni/);ok(sent[sent.length-1].body.reply_markup.keyboard[0][0].request_contact,true);
 await update({contact:{user_id:99,phone_number:'+998901112233'}});assert.match(last(),/o‘zingizning raqamingiz/);ok(users.size,0,'someone else\'s contact is refused');
 await update({contact:{user_id:77,phone_number:'+998 90 111 22 33'}});
 ok(users.size,1);const user=[...users.values()][0];ok(user.email,'tg77@telegram.logoped.uz');ok(members.get(user.id).role,'parent');
 const profile=JSON.parse(settings.get('profile:'+user.id));ok(profile.name,'Dilnoza Karimova');ok(profile.phone,'+998901112233');ok(settings.has('tgstate:77'),false);
 const codeMsg=sent.find(s=>/Saytga kirish kodingiz/.test(s.body.text||''));const code=codeFrom(codeMsg.body.text);assert.match(code,/^\d{6}$/);n++;
 ok(codeMsg.body.reply_markup.inline_keyboard[0][0].url,'https://site.test/login?code='+code);
 ok(await signIn('12345'),400,'short code');ok(verified.length,0);
 ok(await signIn(code),200,'valid code signs in');ok(verified[0].token_hash,'h-'+user.id);ok(verified[0].type,'magiclink');
 ok(await signIn(code),400,'a code works only once');
 // a registered user gets a fresh code; the previous unused one stops working
 await update({text:'🔑 Kirish kodi'});const c2=codeFrom(last()||sent[sent.length-2].body.text)||codeFrom(sent[sent.length-2].body.text);
 await update({text:'/kod'});const c3=codeFrom(sent[sent.length-2].body.text);assert.ok(c2&&c3);n++;
 if(c2!==c3)ok(await signIn(c2),400,'older code is replaced');ok(await signIn(c3),200);ok(users.size,1,'no duplicate account');
 // expired codes are rejected
 await update({text:'/kod'});const c4=codeFrom(sent[sent.length-2].body.text);for(const [k,v] of settings)if(k.startsWith('tgcode:'))settings.set(k,JSON.stringify({...JSON.parse(v),expires:Date.now()-1}));ok(await signIn(c4),400,'expired code');
 // group chats are ignored
 const before=sent.length;await webhook.POST(new Request('https://site.test/api/telegram/webhook',{method:'POST',headers:{'x-telegram-bot-api-secret-token':'s3cret-value'},body:JSON.stringify({message:{chat:{id:-5,type:'group'},from:{id:5},text:'/start'}})}));ok(sent.length,before);
 console.log(n+' Telegram registration and code sign-in checks passed');
})().catch(e=>{console.error(e);process.exit(1)});
