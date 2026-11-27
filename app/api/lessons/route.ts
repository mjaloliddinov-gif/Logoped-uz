import {identity,database,json,sameOrigin} from '../../lib/server';
import {canStudent} from '../../lib/permissions';
import {exercises} from '../../lib/content';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 if(!sameOrigin(req))return json({error:'So‘rov manbasi rad etildi'},403);
 let m:any;try{m=(await identity()).member}catch{return json({error:'Hisobga kiring'},401)}
 if(!['student','parent','admin','logoped'].includes(m.role))return json({error:'Hisob tasdiqlanishi kerak'},403);
 try{
 const raw=await req.text();if(raw.length>2000)return json({error:'So‘rov juda katta'},413);
 const b=JSON.parse(raw);if(typeof b.student!=='string'||typeof b.lesson!=='string'||b.student.length>100||b.lesson.length>100)return json({error:'O‘quvchi va darsni tanlang'},400);
 const db=database(),row=await db.prepare("SELECT * FROM records WHERE id=? AND kind='student'").bind(b.student).first<any>();
 const pupil=row?{...row,data:JSON.parse(row.data)}:null;
 if(!pupil||pupil.data.archived||!canStudent(m,pupil))return json({error:'O‘quvchiga kirish huquqi yo‘q'},403);
 const stored=await db.prepare('SELECT * FROM records WHERE id=?').bind(b.lesson).first<any>();
 const lesson=stored?{...stored,data:JSON.parse(stored.data)}:exercises.find(e=>e.id===b.lesson);
 if(!lesson||!['exercise','video'].includes(lesson.kind)||lesson.data.published===false||lesson.data.access==='staff')return json({error:'Dars topilmadi yoki foydalanish cheklangan'},404);
 const now=new Date(),day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent'}).format(now);
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([pupil.id,lesson.id,day])));
 const key=Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
 const completionId='lesson-'+key,taskId='homework-'+key;
 const existing=await db.prepare('SELECT id FROM records WHERE id=?').bind(completionId).first();
 const due=new Date(day+'T00:00:00Z');due.setUTCDate(due.getUTCDate()+1);
 const title=String(lesson.data.name).slice(0,130);
 const steps=String(lesson.data.steps||lesson.data.body||'').slice(0,2000);
 const body=String(lesson.data.homeworkBody||('Mavzu: '+title+'\n\nDarsdagi mashqni ota-onangiz bilan uyda takrorlang.\n'+steps+'\n\nBajargach, qisqa javob yoki izoh yozib yuboring.')).slice(0,3000);
 const minutes=Math.min(120,Math.max(1,Number(lesson.data.minutes)||5));
 const task={title:'Uyga vazifa: '+title,body,minutes,due:due.toISOString().slice(0,10),status:'Yangi',exercise:lesson.kind==='exercise'?lesson.id:'',sourceLesson:lesson.id,sourceKind:lesson.kind,automatic:true,lessonDate:day};
 const recipients=[pupil.owner,pupil.data.parent,pupil.data.account].filter((id,i,a)=>id&&a.indexOf(id)===i);
 // One transaction; deterministic keys protect against double-clicks, retries and concurrent requests.
 await db.batch([
 db.prepare('INSERT OR IGNORE INTO records VALUES (?,?,?,?,?,?)').bind(completionId,'completion',m.id,pupil.id,JSON.stringify({title,exercise:lesson.kind==='exercise'?lesson.id:undefined,lesson:lesson.id,lessonDate:day,homework:taskId}),now.toISOString()),
 db.prepare('INSERT OR IGNORE INTO records VALUES (?,?,?,?,?,?)').bind(taskId,'task',pupil.owner,pupil.id,JSON.stringify(task),now.toISOString()),
 ...recipients.map(id=>db.prepare("INSERT OR IGNORE INTO notifications VALUES (?,?,?,?,'0')").bind('auto-'+key+'-'+id,id,'Dars tugatildi. Mavzu bo‘yicha yangi uyga vazifa bor.',now.toISOString())),
 db.prepare('INSERT OR IGNORE INTO audit VALUES (?,?,?,?,?)').bind('auto-'+key,m.id,'lesson_completed',taskId,now.toISOString())]);
 return json({ok:true,taskId,alreadyCompleted:!!existing});
 }catch{return json({error:'Dars natijasi saqlanmadi. Qayta urinib ko‘ring.'},400)}
}
