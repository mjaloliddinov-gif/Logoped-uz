const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');
const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync('tests/sqlite-fixtures').filter(x=>x.endsWith('.sql')).sort())sql.exec(fs.readFileSync('tests/sqlite-fixtures/'+f,'utf8'));
let current='admin',testCookie='';const db={prepare(query){let args=[];return {bind(...a){args=a;return this},async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes)}}}}},batch:async a=>{sql.exec('BEGIN');try{const r=await Promise.all(a.map(x=>x.run()));sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}};
const objects=new Map();const bucket={put:async(k,v)=>objects.set(k,v),get:async k=>objects.has(k)?{body:objects.get(k)}:null,delete:async k=>objects.delete(k)};const cache={};function load(file){file=path.resolve(file);if(cache[file])return cache[file];const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const module={exports:{}};vm.runInNewContext('(function(require,module,exports){'+source+'})',{process:{env:{ADMIN_EMAIL:"admin@example.test"}},Response,Request,Headers,URL,TextEncoder,crypto:globalThis.crypto,console,Uint8Array,File,FormData})(name=>name==='next/headers'?{headers:async()=>new Headers({cookie:testCookie})}:name.endsWith('runtime')?{env:{DB:db,BUCKET:bucket}}:name.includes('app-auth')?{getAppUser:async()=>current?{userId:current,email:current+'@example.test',displayName:current}:null}:name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name),module,module.exports);cache[file]=module.exports;return module.exports}
const api=load('app/api/data/route.ts'),reviews=load('app/api/reviews/route.ts'),adminAccess=load('app/api/admin-access/route.ts');let count=0;
const origin='https://test.local';
async function call(method,body,expected=200,query='',o=origin){const url=origin+'/api/reviews'+query;const r=method==='GET'?await reviews.GET(new Request(url)):await reviews.POST(new Request(url,{method:'POST',headers:{origin:o},body:typeof body==='string'?body:JSON.stringify(body)}));const d=await r.json();assert.equal(r.status,expected,JSON.stringify(d));count++;return d}
(async()=>{
const init=await api.POST(new Request(origin+'/api/data',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({action:'initialize'})}));assert.equal(init.status,200);
const setup=await adminAccess.POST(new Request(origin+'/api/admin-access',{method:'POST',headers:{origin},body:JSON.stringify({action:'setup',newCode:'Test-only-code-2026'})}));assert.equal(setup.status,200);const adminCookie=setup.headers.get('set-cookie').split(';')[0];
for(const [id,role]of [['t1','logoped'],['p1','parent'],['p2','parent'],['c1','student'],['x1','pending']])sql.prepare('INSERT INTO members VALUES (?,?,?)').run(id,id+'@example.test',role);
sql.prepare('INSERT INTO settings VALUES (?,?)').run('profile:p1',JSON.stringify({name:'Dilnoza Karimova'}));
// anonymous reads are public; writes need login
current=null;
let r=await call('GET',null,200,'?target=ex0');assert.equal(r.summary.count,0);assert.equal(r.canWrite,false);assert.equal(r.mine,null);
await call('POST',{action:'save',target:'ex0',rating:5,text:'x'},401);
// who may write
current='x1';await call('POST',{action:'save',target:'ex0',rating:5,text:'x'},403);
current='c1';await call('POST',{action:'save',target:'ex0',rating:5,text:'x'},403);
current='p1';
await call('POST',{action:'save',target:'ex0',rating:0,text:''},400);
await call('POST',{action:'save',target:'ex0',rating:6,text:''},400);
await call('POST',{action:'save',target:'ex0',rating:4.5,text:''},400);
await call('POST',{action:'save',target:'ex0',rating:'5',text:''},400);
await call('POST',{action:'save',target:'nope',rating:5,text:''},404);
await call('POST',{action:'save',target:'ex0',rating:5,text:'Ko‘ring https://spam.example'},400);
await call('POST',{action:'save',target:'ex0',rating:5,text:'a'.repeat(601)},400);
await call('POST','not json',400);
await call('POST',{action:'save',target:'ex0',rating:5,text:'Bolamga juda yoqdi'},403,'',  'https://evil.example');
await call('POST',{action:'save',target:'ex0',rating:5,text:'Bolamga juda yoqdi'});
// one review per user per item: saving again updates, does not duplicate
await call('POST',{action:'save',target:'ex0',rating:4,text:'Yangilandi'});
r=await call('GET',null,200,'?target=ex0');assert.equal(r.summary.count,1);assert.equal(r.summary.average,4);assert.equal(r.reviews[0].name,'Dilnoza K.');assert.equal(r.reviews[0].mine,true);assert.equal(r.mine.text,'Yangilandi');assert.equal(r.mine.id,'rv:p1:ex0');assert.equal(r.canWrite,true);
assert.ok(!JSON.stringify(r).includes('p1@example.test'),'email must never be exposed');assert.ok(!('owner' in r.reviews[0]),'owner id must not be exposed');
current='p2';await call('POST',{action:'save',target:'ex0',rating:2,text:''});
r=await call('GET',null,200,'?target=ex0');assert.equal(r.summary.count,2);assert.equal(r.summary.average,3);assert.deepEqual(r.summary.distribution,[0,1,0,1,0]);assert.equal(r.reviews.find(x=>x.mine).name,'p2');
// public summary for cards
current=null;r=await call('GET',null,200,'?summary=1');assert.deepEqual(r.ratings.ex0,{count:2,average:3});
// custom (database) content can be reviewed; unpublished content cannot (except admin)
const now=new Date().toISOString();sql.prepare('INSERT INTO records VALUES (?,?,?,?,?,?)').run('vid1','video','t1',null,JSON.stringify({name:'Video 1',published:true}),now);sql.prepare('INSERT INTO records VALUES (?,?,?,?,?,?)').run('vid2','video','t1',null,JSON.stringify({name:'Draft',published:false}),now);sql.prepare('INSERT INTO records VALUES (?,?,?,?,?,?)').run('stu1','student','t1',null,JSON.stringify({name:'Child'}),now);
current='p1';await call('POST',{action:'save',target:'vid1',rating:5,text:''});await call('POST',{action:'save',target:'vid2',rating:5,text:''},404);await call('POST',{action:'save',target:'stu1',rating:5,text:''},404);
// moderation is admin-only
await call('GET',null,403,'?moderate=1');
await call('POST',{action:'hide',id:'rv:p1:ex0',hidden:true},403);
const target='rv:p2:ex0';await call('POST',{action:'delete',id:'rv:p2:ex0'},403);
current='p2';await call('POST',{action:'delete',id:'rv:p1:ex0'},403);
current='admin';
await call('GET',null,423,'?moderate=1'); // locked until admin code is entered
testCookie=adminCookie;
r=await call('GET',null,200,'?moderate=1');assert.equal(r.reviews.length,3);assert.ok(r.reviews.some(x=>x.targetName==='Video 1'));assert.ok(r.reviews.every(x=>!('owner' in x)&&!JSON.stringify(x).includes('@')));
await call('POST',{action:'hide',id:'rv:p1:ex0',hidden:true});
current=null;r=await call('GET',null,200,'?target=ex0');assert.equal(r.summary.count,1);assert.equal(r.summary.average,2);assert.ok(!r.reviews.some(x=>x.text==='Yangilandi'));
// an author whose review was hidden sees that, and editing cannot silently un-hide it
current='p1';r=await call('GET',null,200,'?target=ex0');assert.equal(r.mine.hidden,true);await call('POST',{action:'save',target:'ex0',rating:5,text:'Qayta'});r=await call('GET',null,200,'?target=ex0');assert.equal(r.mine.hidden,true);assert.equal(r.summary.count,1);
current='admin';await call('POST',{action:'hide',id:'rv:p1:ex0',hidden:false});current=null;r=await call('GET',null,200,'?target=ex0');assert.equal(r.summary.count,2);
// authors may delete their own review; admin may delete any
current='p2';await call('POST',{action:'delete',id:'rv:p2:ex0'});r=await call('GET',null,200,'?target=ex0');assert.equal(r.summary.count,1);
current='admin';await call('POST',{action:'delete',id:'rv:p1:ex0'});await call('POST',{action:'delete',id:'rv:p1:ex0'},404);
// audit trail records actions without review text
const logs=sql.prepare("SELECT action,target FROM audit WHERE action LIKE 'review_%'").all();assert.ok(logs.length>=6);assert.ok(!JSON.stringify(logs).includes('Bolamga'));
// rate limit: 20 saves/hour per user
current='p2';for(let i=0;i<20;i++)sql.prepare('INSERT INTO audit VALUES (?,?,?,?,?)').run('l'+i,'p2','review_save','ex1',new Date().toISOString());
await call('POST',{action:'save',target:'ex1',rating:5,text:''},429);
console.log(count+' review API checks passed');
})().catch(e=>{console.error(e);process.exit(1)});
