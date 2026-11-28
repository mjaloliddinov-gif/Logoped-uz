// Telegram bot: registration by role, logoped approval, invite links and one-time code sign-in.
// Telegram and Supabase Auth are faked; the database is a real SQLite copy of the schema.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),{DatabaseSync}=require('node:sqlite');
const env={TELEGRAM_BOT_TOKEN:'123:abc',TELEGRAM_WEBHOOK_SECRET:'s3cret-value',NEXT_PUBLIC_SITE_URL:'https://site.test',NEXT_PUBLIC_SUPABASE_URL:'https://x.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_x',SUPABASE_SECRET_KEY:'sb_secret_x'};
const load=(file,mods,extra={})=>{const m={exports:{}};const src=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext('(function(require,module,exports){'+src+'})',{URL,Date,JSON,crypto,TextEncoder,Uint8Array,Uint32Array,Array,String,Number,Error,Response,Request,AbortSignal,Set,Promise,setTimeout,console:{error:()=>{}},process:{env},...extra})(n=>{for(const k of Object.keys(mods))if(n.includes(k))return mods[k];throw Error('unexpected require '+n)},m,m.exports);return m.exports};
const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync('tests/sqlite-fixtures').filter(x=>x.endsWith('.sql')).sort())sql.exec(fs.readFileSync('tests/sqlite-fixtures/'+f,'utf8'));
const database={prepare(query){let args=[];return {bind(...a){args=a;return this},async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes)}}}}},async batch(a){sql.exec('BEGIN');try{const r=[];for(const x of a)r.push(await x.run());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}};
const row=(q,...a)=>sql.prepare(q).get(...a);
// --- fake Telegram + Supabase ---
const sent=[];const fetch=async(url,init)=>{const body=JSON.parse(init.body);sent.push({method:url.split('/').pop(),body});return {json:async()=>({ok:true,result:url.endsWith('getMe')?{username:'logoped_test_bot'}:true})}};
const users=new Map();const verified=[];
const admin={createUser:async({email,user_metadata})=>{if([...users.values()].some(u=>u.email===email))return {data:{user:null},error:{code:'email_exists'}};const id='u'+(users.size+1);users.set(id,{id,email,user_metadata});return {data:{user:{id,email}},error:null}},
 generateLink:async({email})=>{const u=[...users.values()].find(x=>x.email===email);return {data:{user:u?{id:u.id}:null,properties:{hashed_token:'h-'+(u&&u.id)}}}}};
const config=load('app/lib/auth-config.ts',{});
const tg=load('app/lib/telegram.ts',{'server-only':{},'supabase-js':{createClient:()=>({auth:{admin}})},'auth-config':config,'./postgres':{database}},{fetch});
const permissions=load('app/lib/permissions.ts',{});
const invites=load('app/lib/invite-accept.ts',{'./permissions':permissions});
const webhook=load('app/api/telegram/webhook/route.ts',{'lib/postgres':{database},'lib/auth-config':config,'lib/telegram':tg,'lib/invite-accept':invites},{fetch});
const login=load('app/api/auth/telegram/route.ts',{'supabase/server':{authClient:async()=>({auth:{verifyOtp:async b=>{verified.push(b);return {error:null}}}})},'lib/server':{json:(d,s=200)=>Response.json(d,{status:s}),sameOrigin:()=>true},'admin-security':{attemptAllowed:async()=>true},'lib/telegram':tg});
let n=0;const ok=(a,b,m)=>{assert.equal(a,b,m);n++};
const post=body=>webhook.POST(new Request('https://site.test/api/telegram/webhook',{method:'POST',headers:{'x-telegram-bot-api-secret-token':'s3cret-value'},body:JSON.stringify(body)}));
const msg=(uid,m)=>post({message:{chat:{id:uid,type:'private'},from:{id:uid,username:'u'+uid},...m}});
const say=(uid,text)=>msg(uid,{text});
const contact=(uid,owner=uid)=>msg(uid,{contact:{user_id:owner,phone_number:'+99890'+String(uid).padStart(7,'0')}});
const to=uid=>sent.filter(s=>s.body.chat_id===uid);
const lastTo=uid=>{const l=to(uid);return l[l.length-1]?.body.text||''};
const codeFor=uid=>{const m=to(uid).filter(s=>/kirish kodingiz/.test(s.body.text||''));return (m[m.length-1].body.text.match(/<b>(\d{6})<\/b>/)||[])[1]};
const signIn=async code=>(await login.POST(new Request('https://site.test/api/auth/telegram',{method:'POST',body:JSON.stringify({code})}))).status;
const userOf=uid=>[...users.values()].find(u=>u.email==='tg'+uid+'@telegram.logoped.uz');
const roleOf=id=>row('SELECT role FROM members WHERE id=?',id)?.role;
const profileOf=id=>JSON.parse(row('SELECT value FROM settings WHERE id=?','profile:'+id).value);
(async()=>{
 sql.prepare("INSERT INTO members VALUES ('admin1','a@x','admin')").run();
 sql.prepare("INSERT INTO settings VALUES ('telegram_approvers',?)").run(JSON.stringify({ids:[500]}));
 ok((await webhook.POST(new Request('https://site.test/api/telegram/webhook',{method:'POST',headers:{'x-telegram-bot-api-secret-token':'wrong'},body:'{}'}))).status,403,'wrong secret');
 // --- parent: role question, own contact only, active at once ---
 await say(77,'/start');assert.match(lastTo(77),/Siz kimsiz\?[\s\S]*Ota-ona[\s\S]*O‘quvchi[\s\S]*Logoped/);n++;
 await say(77,'salom');assert.match(lastTo(77),/tugmalardan birini bosing/);n++;
 await say(77,'👨‍👩‍👧 Ota-ona');assert.match(lastTo(77),/ismingiz va familiyangizni/);n++;
 await say(77,'A');assert.match(lastTo(77),/matn bilan yozing/);n++;
 await say(77,'Dilnoza Karimova');assert.match(lastTo(77),/telefon raqamingizni/);
 await contact(77,99999);ok(userOf(77),undefined,'someone else\'s contact is refused');
 await contact(77);const parent=userOf(77);ok(roleOf(parent.id),'parent');ok(profileOf(parent.id).phone,'+998900000077');
 const c1=codeFor(77);assert.match(c1,/^\d{6}$/);n++;
 assert.ok(to(77).some(s=>s.body.reply_markup?.inline_keyboard?.[0]?.[0]?.url==='https://site.test/login?code='+c1));n++;
 ok(await signIn('12345'),400);ok(await signIn(c1),200);ok(verified.at(-1).token_hash,'h-'+parent.id);ok(await signIn(c1),400,'single use');
 await say(77,'/kod');assert.match(to(77).filter(s=>/kodingiz/.test(s.body.text||'')).at(-1).body.text,/Siz <b>ota-ona<\/b> sifatida kirasiz/);n++;
 const c2=codeFor(77);await say(77,'🔑 Kirish kodi');const c3=codeFor(77);if(c2!==c3)ok(await signIn(c2),400,'older code replaced');ok(await signIn(c3),200);
 // --- logoped: pending until an approver confirms in Telegram ---
 await say(88,'/start');await say(88,'🩺 Logoped');await say(88,'Aziza Olimova');assert.match(lastTo(88),/Administrator sizni/);n++;
 await contact(88);const lg=userOf(88);ok(roleOf(lg.id),'pending');assert.match(lastTo(88),/logoped<\/b> sifatida ro‘yxatdan o‘tdingiz/);
 ok(to(88).some(s=>/kirish kodingiz/.test(s.body.text||'')),false,'no code before approval');
 const ask=to(500).at(-1);assert.match(ask.body.text,/Yangi logoped so‘rovi[\s\S]*Aziza Olimova/);ok(ask.body.reply_markup.inline_keyboard[0][0].callback_data,'ap:'+lg.id);
 ok(Number(row("SELECT count(*) n FROM notifications WHERE owner='admin1'").n),1,'administrator notified on the site');
 await post({callback_query:{id:'q1',from:{id:77},data:'ap:'+lg.id,message:{chat:{id:77},message_id:1,text:'x'}}});ok(roleOf(lg.id),'pending','only approvers can approve');
 assert.match(sent.filter(s=>s.method==='answerCallbackQuery').at(-1).body.text,/huquqi yo‘q/);n++;
 await post({callback_query:{id:'q2',from:{id:500},data:'ap:'+lg.id,message:{chat:{id:500},message_id:7,text:ask.body.text}}});
 ok(roleOf(lg.id),'logoped');assert.match(lastTo(88)||to(88).at(-2).body.text,/kodingiz|«🔑/);n++;
 assert.match(to(88).filter(s=>/kodingiz/.test(s.body.text||'')).at(-1).body.text,/Hisobingiz tasdiqlandi[\s\S]*logoped/);n++;
 assert.match(sent.filter(s=>s.method==='editMessageText').at(-1).body.text,/Tasdiqlandi/);n++;
 await say(89,'/start');await say(89,'🩺 Logoped');await say(89,'Soxta Odam');await contact(89);const fake=userOf(89);
 await post({callback_query:{id:'q3',from:{id:500},data:'rj:'+fake.id,message:{chat:{id:500},message_id:8,text:'x'}}});ok(roleOf(fake.id),'pending');ok(profileOf(fake.id).requestedRole,'rejected');assert.match(lastTo(89),/tasdiqlanmadi/);
 // --- invites open the bot and link the account to the child ---
 const now=new Date().toISOString(),later=new Date(Date.now()+86400000).toISOString();
 sql.prepare("INSERT INTO records VALUES ('kid1','student',?,NULL,?,?)").run(lg.id,JSON.stringify({name:'Ali Valiyev',consent:true,parent:'',account:''}),now);
 const tokP='a'.repeat(48),tokS='b'.repeat(48);
 for(const [id,tok,role] of [['inv1',tokP,'parent'],['inv2',tokS,'student']])sql.prepare("INSERT INTO invites VALUES (?,?,'',?,?,?,?,?,'pending',NULL)").run(id,await invites.inviteHash(tok),'kid1',role,lg.id,now,later);
 await say(120,'/start inv_'+tokP);assert.match(lastTo(120),/Ali Valiyev<\/b> uchun <b>ota-ona<\/b>/);n++;
 await say(120,'Malika Valiyeva');await contact(120);const mom=userOf(120);
 ok(roleOf(mom.id),'parent');ok(JSON.parse(row("SELECT data FROM records WHERE id='kid1'").data).parent,mom.id,'parent linked to the child');
 ok(row("SELECT status FROM invites WHERE id='inv1'").status,'accepted');assert.match(to(120).filter(s=>/kodingiz/.test(s.body.text||'')).at(-1).body.text,/Ali Valiyev<\/b> profiliga ulandingiz[\s\S]*ota-ona/);n++;
 await say(77,'/start inv_'+tokP);assert.match(lastTo(77),/yaroqsiz|muddati/);n++;
 // a student who registered first opens the invite later
 await say(99,'/start');await say(99,'🧒 O‘quvchi');await say(99,'Ali Valiyev');await contact(99);const kid=userOf(99);ok(roleOf(kid.id),'pending');assert.match(to(99).filter(s=>/kodingiz/.test(s.body.text||'')).at(-1).body.text,/o‘quvchi<\/b>siz[\s\S]*taklif havolasini/);
 await say(99,'/start inv_'+tokS);ok(roleOf(kid.id),'student');ok(JSON.parse(row("SELECT data FROM records WHERE id='kid1'").data).account,kid.id);
 await say(130,'/start inv_'+'c'.repeat(48));assert.match(lastTo(130),/yaroqsiz/);n++;
 // group chats are ignored
 const before=sent.length;await post({message:{chat:{id:-5,type:'group'},from:{id:5},text:'/start'}});ok(sent.length,before);
 // --- notifications reach linked chats with escaped content ---
 const tn=load('app/lib/telegram-notify.ts',{'server-only':{},'auth-config':config,'./telegram':tg},{fetch});
 const m=tn.describeRecord('grade',{title:'R <tovushi>',score:4,criteria:'aniq',comment:'Barakalla & davom'},'Ali',true);
 assert.match(m,/4 \/ 5/);assert.ok(m.includes('R &lt;tovushi&gt;')&&m.includes('Barakalla &amp; davom'));n++;
 assert.match(tn.describeRecord('task',{title:'Uy',body:'Mashq',due:'2026-12-01',status:'Yangi'},'Ali',true),/Uyga vazifa[\s\S]*Muddat: 2026-12-01/);n++;
 assert.match(tn.describeRecord('task',{title:'Uy',status:'Bajarildi',answer:'qildik'},'Ali',false),/Vazifa bajarildi[\s\S]*qildik/);n++;
 const b2=sent.length;await tn.telegramPush([parent.id,'nobody',parent.id],'<b>salom</b>');const pushed=sent.slice(b2);ok(pushed.length,1);ok(pushed[0].body.chat_id,77);
 console.log(n+' Telegram registration, approval, invite and code sign-in checks passed');
})().catch(e=>{console.error(e);process.exit(1)});
