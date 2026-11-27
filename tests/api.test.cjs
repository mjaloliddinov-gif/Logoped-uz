const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');
const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync('tests/sqlite-fixtures').filter(x=>x.endsWith('.sql')).sort())sql.exec(fs.readFileSync('tests/sqlite-fixtures/'+f,'utf8'));
let current='admin',testCookie='';const db={prepare(query){let args=[];return {bind(...a){args=a;return this},async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes)}}}}},batch:async a=>{sql.exec('BEGIN');try{const r=await Promise.all(a.map(x=>x.run()));sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}};
const objects=new Map();const bucket={put:async(k,v)=>objects.set(k,v),get:async k=>objects.has(k)?{body:objects.get(k)}:null,delete:async k=>objects.delete(k)};const cache={};function load(file){file=path.resolve(file);if(cache[file])return cache[file];const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const module={exports:{}};vm.runInNewContext('(function(require,module,exports){'+source+'})',{process:{env:{ADMIN_EMAIL:"admin@example.test"}},Response,Request,Headers,URL,TextEncoder,crypto:globalThis.crypto,console,Uint8Array,File,FormData})(name=>name==='next/headers'?{headers:async()=>new Headers({cookie:testCookie})}:name.endsWith('runtime')?{env:{DB:db,BUCKET:bucket}}:name.includes('app-auth')?{getAppUser:async()=>current?{userId:current,email:current+'@example.test',displayName:current}:null}:name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name),module,module.exports);cache[file]=module.exports;return module.exports}
const api=load('app/api/data/route.ts');const invites=load('app/api/invites/route.ts');const files=load('app/api/files/route.ts');const validation=load('app/lib/validation.ts');let count=0;async function post(body,expected=200,origin='https://test.local'){const r=await api.POST(new Request('https://test.local/api/data',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));const d=await r.json();assert.equal(r.status,expected,JSON.stringify(d));count++;return d}
(async()=>{
await post({action:'initialize'});
const adminAccess=load('app/api/admin-access/route.ts');
const setup=await adminAccess.POST(new Request('https://test.local/api/admin-access',{method:'POST',headers:{origin:'https://test.local'},body:JSON.stringify({action:'setup',newCode:'Test-only-code-2026'})}));assert.equal(setup.status,200);testCookie=setup.headers.get('set-cookie').split(';')[0];
await post({action:'initialize'},409);
for(const [id,role]of [['t1','logoped'],['t2','logoped'],['p1','parent'],['p2','parent'],['c1','student']])sql.prepare('INSERT INTO members VALUES (?,?,?)').run(id,id+'@example.test',role);
await post({kind:'student',data:{name:'Denied',consent:true}},403);
await post({action:'care_access',enabled:true});
current='t1';const a=await post({kind:'student',data:{name:'Test one',group:'A',consent:true}});
current='t2';const b=await post({kind:'student',data:{name:'Test two',group:'B',consent:true}});
async function invitation(body,expected=200){const r=await invites.POST(new Request('https://test.local/api/invites',{method:'POST',headers:{origin:'https://test.local'},body:JSON.stringify(body)}));const d=await r.json();assert.equal(r.status,expected,JSON.stringify(d));count++;return d}
current='t1';const link=await invitation({action:'create',student:a.id,role:'parent',email:'p1@example.test'});const token=link.url.split('#')[1];current='p2';await invitation({action:'accept',token},403);current='p1';await invitation({action:'accept',token});await invitation({action:'accept',token},403);
const child=await invitation({action:'create',student:a.id,role:'student',email:'c1@example.test'});current='c1';await invitation({action:'accept',token:child.url.split('#')[1]});
current='t2';const second=await invitation({action:'create',student:b.id,role:'parent',email:'p2@example.test'});current='p2';await invitation({action:'accept',token:second.url.split('#')[1]});
current='admin';assert(!(await(await api.GET()).json()).records.some(r=>r.kind==='student'));count++;
current='t1';const task=await post({kind:'task',student:a.id,data:{title:'Original',body:'Protected',status:'Yangi'}});await post({kind:'task',student:b.id,data:{title:'Denied'}},403);
current='p1';const visible=await (await api.GET()).json();assert(visible.records.some(r=>r.id===a.id));assert(!visible.records.some(r=>r.id===b.id));assert.equal(visible.notifications.length,1);count+=3;
await post({id:task.id,data:{status:'Logoped tekshirdi'}},403);await post({id:task.id,data:{status:'Logoped tekshiruvini kutmoqda',title:'Tampered',parentComment:'Done'}});const after=JSON.parse(sql.prepare('SELECT data FROM records WHERE id=?').get(task.id).data);assert.equal(after.title,'Original');assert.equal(after.parentComment,'Done');count+=2;
await post({kind:'observation',student:a.id,data:{correct:1,total:2}},403);await post({action:'role',id:'p1',role:'logoped'},403);await post({kind:'favorite',data:{exercise:'ex0',active:true}});await post({action:'read'});assert.equal(sql.prepare('SELECT seen FROM notifications WHERE owner=?').get('p1').seen,'1');count++;
current='p2';await post({id:task.id,data:{status:'Bajarilmoqda'}},403);assert(!(await(await api.GET()).json()).records.some(r=>r.kind==='favorite'));count++;
current='t1';await post({kind:'observation',student:a.id,data:{correct:3,total:2}},400);await post({kind:'observation',student:a.id,data:{correct:1.5,total:2}},400);await post({kind:'observation',student:a.id,data:{correct:1,total:2,date:'2026-10-10',sound:'A'}});
current='admin';await post({kind:'video',data:{name:'X',url:'https://evil.test/watch'}},400);await post({kind:'exercise',id:'ex0',data:{name:'Updated',published:true}});assert.equal(sql.prepare('SELECT id FROM records WHERE id=?').get('ex0').id,'ex0');count++;
await post({kind:'resource',data:{name:'Private',access:'staff',published:true}});current='p1';assert(!(await(await api.GET()).json()).records.some(r=>r.data.name==='Private'));count++;
await post({kind:'favorite',data:{exercise:'ex1'}},403,'https://evil.test');current=null;assert.equal((await api.GET()).status,401);count++;
assert.equal(validation.fileType(new Uint8Array([37,80,68,70,45]),'application/pdf'),true);assert.equal(validation.fileType(new Uint8Array([60,104,116,109,108]),'application/pdf'),false);assert.equal(validation.csvCell('=SUM(A1)'), '"\'=SUM(A1)"');count+=3;
current='admin';const f=new FormData();f.set('name','Private PDF');f.set('access','staff');f.set('file',new File(['%PDF-1.7\nTEST'],'test.pdf',{type:'application/pdf'}));const up=await files.POST(new Request('https://test.local/api/files',{method:'POST',headers:{origin:'https://test.local'},body:f}));assert.equal(up.status,200);const file=await up.json();count++;
current='p1';assert.equal((await files.GET(new Request('https://test.local/api/files?id='+file.id))).status,403);count++;
current='t1';assert.equal((await files.GET(new Request('https://test.local/api/files?id='+file.id))).status,200);count++;
assert.equal((await files.POST(new Request('https://test.local/api/files',{method:'POST',headers:{origin:'https://test.local'},body:f}))).status,200);count++;
current='admin';const bad=new FormData();bad.set('file',new File(['<html>fake</html>'],'fake.pdf',{type:'application/pdf'}));assert.equal((await files.POST(new Request('https://test.local/api/files',{method:'POST',headers:{origin:'https://test.local'},body:bad}))).status,400);count++;
assert.equal((await files.POST(new Request('https://test.local/api/files',{method:'POST',headers:{origin:'https://test.local','content-length':String(12*1024*1024)},body:f}))).status,413);count++;
current='newparent';await post({action:'join',name:'Test Parent',requestedRole:'admin'},400);await post({action:'join',name:'A',requestedRole:'parent'},400);await post({action:'join',name:'Test Parent',requestedRole:'parent',role:'admin'});assert.equal(sql.prepare('SELECT role FROM members WHERE id=?').get(current).role,'pending');count++;
const own=await(await api.GET()).json();assert.equal(own.me.profile.name,'Test Parent');assert.equal(own.me.profile.requestedRole,'parent');assert.equal(own.users.length,0);count+=3;
await post({action:'role',id:'newparent',role:'logoped'},403);await post({kind:'article',data:{name:'Not permitted',published:true}},403);
current='admin';const adminView=await(await api.GET()).json();assert.equal(adminView.users.find(x=>x.id==='newparent').profile.name,'Test Parent');count++;
await post({action:'role',id:'missing-user',role:'parent'},404);await post({action:'role',id:'newparent',role:'parent'});
current='newparent';assert.equal((await(await api.GET()).json()).me.role,'parent');count++;await post({action:'join',name:'Changed role',requestedRole:'logoped'},409);
current='p1';assert.equal((await(await api.GET()).json()).me.profile,null);count++;
current='t1';await post({id:task.id,data:{status:'Logoped tekshirdi',reviewComment:'Well done'}});
await post({kind:'note',student:a.id,data:{title:'Private clinical note',body:'Restricted'}});
await post({kind:'skill',student:a.id,data:{sound:'R',status:'Mashq qilinmoqda'}});
await post({action:'group_session',students:[a.id,b.id],data:{title:'Group',date:'2026-10-12',time:'10:00'}},403);
await post({action:'group_session',students:[a.id],data:{title:'Group',date:'2026-10-12',time:'10:00'}});
const article=await post({kind:'article',data:{name:'Teacher article',published:true}});current='t2';await post({id:article.id,data:{name:'Tampered'}},403);
current='c1';const childView=await(await api.GET()).json();assert(!childView.records.some(r=>['note','observation','skill','session'].includes(r.kind)));assert.equal(childView.records.find(r=>r.id===a.id).data.goal,undefined);assert.equal(childView.records.find(r=>r.id===task.id).data.reviewComment,undefined);count+=3;
await post({id:task.id,data:{status:'Bajarildi'}},403);
current='p1';await post({id:task.id,data:{status:'Bajarildi'}},403);
current='admin';await post({action:'today_schedule',date:'2026-10-12',id:'ex0'});assert.equal((await(await api.GET()).json()).todaySchedule['2026-10-12'],'ex0');count++;
const chat=load('app/api/chat/route.ts');
async function chatPost(body,status=200,origin='https://test.local'){const r=await chat.POST(new Request('https://test.local/api/chat',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));count++;return d}
async function chatGet(peer='',status=200,before){const q=new URLSearchParams({peer});if(before)q.set('before',JSON.stringify(before));const r=await chat.GET(new Request('https://test.local/api/chat?'+q));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));count++;return d}
current='p1';const msg=await chatPost({action:'send',peer:'admin',text:'Uy vazifasi haqida savolim bor'});assert.equal((await chatGet('admin')).messages[0].text,'Uy vazifasi haqida savolim bor');count++;
await chatPost({action:'send',peer:'p2',text:'Forbidden'},403);await chatPost({action:'send',peer:'admin',text:'   '},400);await chatPost({action:'send',peer:'admin',text:'x'.repeat(3001)},400);await chatPost({action:'send',peer:'admin',text:'Bad origin'},403,'https://evil.test');
current='p2';assert.equal((await chatGet('admin')).messages.length,0);count++;await chatGet('p1',403);await chatPost({action:'read',peer:'admin',ids:[msg.id]});assert.equal(JSON.parse(sql.prepare('SELECT data FROM records WHERE id=?').get(msg.id).data).seen,'0');count++;
current='admin';const conv=await chatGet('p1');assert.equal(conv.messages.length,1);assert.equal(conv.contacts.find(x=>x.id==='p1').unread,1);count+=2;await chatPost({action:'read',peer:'p1',ids:[msg.id]});await chatPost({action:'send',peer:'p1',text:'Mashqni 5 daqiqa davom ettiring.'});
current='p1';const reply=await chatGet('admin');assert.equal(reply.messages.length,2);assert.equal(reply.messages.find(x=>x.id===msg.id).seen,'1');assert(!(await(await api.GET()).json()).records.some(x=>x.kind==='message'));count+=3;
current='c1';await chatGet('admin');await chatPost({action:'send',peer:'admin',text:'Student question'});current='t1';await chatGet('p1',403);current='unapproved';await chatGet('admin',403);current=null;await chatGet('admin',401);
current='admin';const ownStudent=await post({kind:'student',data:{name:'Admin pupil',consent:true}});const home=await post({kind:'task',student:ownStudent.id,data:{title:'Mashq',body:'Bosqichlar',due:'2026-10-15',minutes:5,status:'Yangi'}});
const gradeData={title:'Mashq bahosi',criteria:'Ko‘rsatmani bajarish',date:'2026-10-11',score:4,comment:'Ota-ona uchun izoh',task:home.id};
const grade=await post({kind:'grade',student:ownStudent.id,data:gradeData});await post({kind:'grade',student:a.id,data:gradeData},403);await post({kind:'grade',student:ownStudent.id,data:{...gradeData,score:6}},400);await post({kind:'grade',student:ownStudent.id,data:{...gradeData,score:2.5}},400);await post({kind:'grade',student:ownStudent.id,data:{...gradeData,task:task.id}},400);
await post({kind:'note',student:ownStudent.id,data:{title:'Tavsiya',body:'Birga davom ettiring'}});await post({kind:'note',student:ownStudent.id,data:{title:'',body:''}},400);await post({action:'care_access',enabled:false});await post({id:grade.id,data:gradeData},403);assert(!(await(await api.GET()).json()).records.some(r=>r.id===grade.id));count++;
current='t1';const g=await post({kind:'grade',student:a.id,data:{...gradeData,task:task.id}});current='p1';const pv=await(await api.GET()).json();assert.equal(pv.records.find(r=>r.id===g.id).data.score,4);assert(!pv.records.some(r=>r.id===grade.id));count+=2;await post({id:g.id,data:{...gradeData,score:5}},403);
current='c1';const cv=await(await api.GET()).json();assert.equal(cv.records.find(r=>r.id===g.id).data.score,4);assert.equal(cv.records.find(r=>r.id===g.id).data.comment,undefined);count+=2;current='p2';assert(!(await(await api.GET()).json()).records.some(r=>r.id===g.id));count++;
// Pagination stays within one conversation, including equal timestamps.
for(let i=0;i<53;i++)sql.prepare('INSERT INTO records VALUES (?,?,?,?,?,?)').run('pagination-'+String(i).padStart(3,'0'),'message','p1',null,JSON.stringify({recipient:'admin',text:'Page '+i,seen:'0'}),'2026-01-01T00:00:00.000Z');
current='p1';const first=await chatGet('admin');assert.equal(first.messages.length,50);assert.equal(first.hasMore,true);const next=await chatGet('admin',200,[first.messages[0].created,first.messages[0].id]);assert.equal(next.messages.length,5);assert.equal(next.hasMore,false);assert(!next.messages.some(m=>first.messages.some(n=>n.id===m.id)));count+=5;
current='admin';await post({action:'role',id:'p1',role:'pending'});current='p1';await chatGet('admin',403);current='admin';await chatGet('p1',403);

current='admin';await post({action:'care_access',enabled:true});const adminLink=await invitation({action:'create',student:ownStudent.id,role:'parent',email:'newparent@example.test'});
current='newparent';await invitation({action:'accept',token:adminLink.url.split('#')[1]});const adminAssigned=await(await api.GET()).json();assert(adminAssigned.records.some(r=>r.id===home.id));assert.equal(adminAssigned.records.find(r=>r.id===grade.id).data.score,4);assert(adminAssigned.records.some(r=>r.student===ownStudent.id&&r.kind==='note'));count+=3;
await post({id:home.id,data:{status:'Bajarildi',answer:'Birgalikda bajardik'}});current='admin';await post({id:home.id,data:{status:'Logoped tekshirdi',reviewComment:'Yaxshi bajarilgan'}});current='newparent';assert.equal((await(await api.GET()).json()).records.find(r=>r.id===home.id).data.reviewComment,'Yaxshi bajarilgan');count++;

// Student conversations are separate from parent and other student conversations.
current='admin';const childChat=await chatGet('c1');assert(childChat.messages.some(x=>x.text==='Student question'));assert(!childChat.messages.some(x=>x.sender==='p1'));count+=2;
sql.prepare('INSERT INTO members VALUES (?,?,?)').run('c2','c2@example.test','student');
await chatPost({action:'send',peer:'c1',text:'Private reply for c1'});
current='c2';assert.equal((await chatGet('admin')).messages.length,0);count++;await chatGet('c1',403);await chatPost({action:'send',peer:'c1',text:'Forbidden'},403);
current='p2';assert(!(await chatGet('admin')).messages.some(x=>x.text==='Private reply for c1'));count++;
current='c1';assert((await chatGet('admin')).messages.some(x=>x.text==='Private reply for c1'));assert(!(await(await api.GET()).json()).records.some(x=>x.kind==='message'));count+=2;
// Completing a topic creates a scoped, durable homework exactly once per local day.
const lessons=load('app/api/lessons/route.ts');
async function finish(body,status=200,origin='https://test.local'){const r=await lessons.POST(new Request('https://test.local/api/lessons',{method:'POST',headers:{origin},body:JSON.stringify(body)}));const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));count++;return d}
const completed=await finish({student:a.id,lesson:'ex4'});let auto=JSON.parse(sql.prepare('SELECT data FROM records WHERE id=?').get(completed.taskId).data);
assert(auto.body.includes('Mevalarni nomlaymiz'));assert(auto.body.includes('Olma, nok va uzumni'));assert.equal(auto.status,'Yangi');assert.equal(auto.automatic,true);count+=4;
const notices=sql.prepare('SELECT COUNT(*) n FROM notifications').get().n;
const repeated=await finish({student:a.id,lesson:'ex4'});assert.equal(repeated.taskId,completed.taskId);assert.equal(repeated.alreadyCompleted,true);assert.equal(sql.prepare('SELECT COUNT(*) n FROM notifications').get().n,notices);count+=3;
assert((await(await api.GET()).json()).records.some(r=>r.id===completed.taskId));count++;
await finish({student:b.id,lesson:'ex4'},403);await finish({student:a.id,lesson:'absent'},404);await finish({student:a.id,lesson:'ex4'},403,'https://other.test');
current='p2';await finish({student:a.id,lesson:'ex4'},403);assert(!(await(await api.GET()).json()).records.some(r=>r.id===completed.taskId));count++;
current='admin';await finish({student:a.id,lesson:'ex4'},403);
const video=await post({kind:'video',data:{name:'Mavzu video',url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',homeworkBody:'Teacher approved exact task',minutes:7,published:true}});
current='t1';const vf=await finish({student:a.id,lesson:video.id});auto=JSON.parse(sql.prepare('SELECT data FROM records WHERE id=?').get(vf.taskId).data);assert.equal(auto.body,'Teacher approved exact task');assert.equal(auto.minutes,7);count+=2;
current='admin';await post({id:video.id,data:{name:'Hidden',url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',published:false}});current='c1';await finish({student:a.id,lesson:video.id},404);
current='p2';const parentFinish=await finish({student:b.id,lesson:'ex3'});const br=JSON.parse(sql.prepare('SELECT data FROM records WHERE id=?').get(b.id).data);sql.prepare('UPDATE records SET data=? WHERE id=?').run(JSON.stringify({...br,parent:''}),b.id);assert(!(await(await api.GET()).json()).records.some(r=>r.id===parentFinish.taskId||r.data.homework===parentFinish.taskId));count++;
current='c1';const taskCount=sql.prepare("SELECT COUNT(*) n FROM records WHERE kind='task'").get().n;await post({id:completed.taskId,data:{status:'Bajarildi',answer:'Done'}});assert.equal(sql.prepare("SELECT COUNT(*) n FROM records WHERE kind='task'").get().n,taskCount);count++;
current='t1';await post({id:completed.taskId,data:{...JSON.parse(sql.prepare('SELECT data FROM records WHERE id=?').get(completed.taskId).data),status:'Logoped tekshirdi',reviewComment:'Checked'}});
current='c1';await finish({student:a.id,lesson:'ex4'});assert.equal(JSON.parse(sql.prepare('SELECT data FROM records WHERE id=?').get(completed.taskId).data).status,'Logoped tekshirdi');count++;
const completion=sql.prepare("SELECT id FROM records WHERE kind='completion' AND student=? AND json_extract(data,'$.lesson')='ex4'").get(a.id);await post({id:completion.id,data:{title:'Tampered'}},403);
current='admin';await post({action:'role',id:'c2',role:'pending'});await chatGet('c2',403);current='c2';await chatGet('admin',403);await finish({student:b.id,lesson:'ex0'},403);current=null;await finish({student:a.id,lesson:'ex0'},401);
// Review workflow: atomic task + grade + feedback, authorization and repeat protection.
current='admin';const reviewTask=await post({kind:'task',student:ownStudent.id,data:{title:'Review topic',body:'Instructions',status:'Yangi'}});
await post({action:'review_task',id:reviewTask.id,comment:'Checked'},409);
current='newparent';await post({id:reviewTask.id,data:{status:'Bajarildi',answer:'Parent response'}});
await post({action:'review_task',id:reviewTask.id,comment:'Self review',score:5,criteria:'All'},403);
current='t2';await post({action:'review_task',id:reviewTask.id,comment:'Other teacher'},403);
current='admin';await post({action:'care_access',enabled:false});await post({action:'review_task',id:reviewTask.id,comment:'No care'},403);await post({action:'care_access',enabled:true});
await post({action:'review_task',id:reviewTask.id,comment:'Checked',score:6,criteria:'Steps'},400);
await post({action:'review_task',id:reviewTask.id,comment:'Checked',score:4,criteria:''},400);
await post({action:'review_task',id:reviewTask.id,comment:'',score:4,criteria:'Steps'},400);
assert.equal(JSON.parse(sql.prepare('SELECT data FROM records WHERE id=?').get(reviewTask.id).data).status,'Bajarildi');count++;
const reviewed=await post({action:'review_task',id:reviewTask.id,comment:'Clear work',score:4,criteria:'Steps completed'});
const savedReview=JSON.parse(sql.prepare('SELECT data FROM records WHERE id=?').get(reviewTask.id).data);
assert.equal(savedReview.status,'Logoped tekshirdi');assert.equal(savedReview.answer,'Parent response');assert.equal(savedReview.reviewComment,'Clear work');count+=3;
assert.equal(JSON.parse(sql.prepare('SELECT data FROM records WHERE id=?').get(reviewed.gradeId).data).score,4);count++;
const noticeCount=sql.prepare('SELECT COUNT(*) n FROM notifications').get().n;await post({action:'review_task',id:reviewTask.id,comment:'Duplicate',score:5,criteria:'Steps'},409);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM notifications').get().n,noticeCount);assert.equal(JSON.parse(sql.prepare('SELECT data FROM records WHERE id=?').get(reviewed.gradeId).data).score,4);count+=2;
current='newparent';const parentReview=await(await api.GET()).json();assert(parentReview.records.some(r=>r.id===reviewed.gradeId));assert.equal(parentReview.records.find(r=>r.id===reviewTask.id).data.reviewComment,'Clear work');count+=2;
current='p2';assert(!(await(await api.GET()).json()).records.some(r=>r.id===reviewed.gradeId));count++;
current='admin';const ungraded=await post({kind:'task',student:ownStudent.id,data:{title:'Ungraded review',status:'Bajarildi'}});const ungradedResult=await post({action:'review_task',id:ungraded.id,comment:'Reviewed without a mark',score:null});assert.equal(ungradedResult.gradeId,null);assert.equal(sql.prepare('SELECT id FROM records WHERE id=?').get('review-'+ungraded.id),undefined);count+=2;
// A failed grade write must not mark the task reviewed or send a notice.
const rollbackTask=await post({kind:'task',student:ownStudent.id,data:{title:'Atomic review',status:'Bajarildi'}});
const beforeRollback=sql.prepare('SELECT COUNT(*) n FROM notifications').get().n;
sql.exec("CREATE TRIGGER fail_review BEFORE INSERT ON records WHEN NEW.kind='grade' BEGIN SELECT RAISE(ABORT,'test failure'); END");
await post({action:'review_task',id:rollbackTask.id,comment:'Attempt',score:4,criteria:'Steps'},400);
sql.exec('DROP TRIGGER fail_review');
assert.equal(JSON.parse(sql.prepare('SELECT data FROM records WHERE id=?').get(rollbackTask.id).data).status,'Bajarildi');assert.equal(sql.prepare('SELECT COUNT(*) n FROM notifications').get().n,beforeRollback);count+=2;
console.log(`${count} API, authorization, notification, validation and migration checks passed`);
})().catch(e=>{console.error(e);process.exit(1)});
