import {env} from '../../lib/runtime';
import {identity,database,json,sameOrigin} from '../../lib/server';
export const dynamic='force-dynamic';
const config=()=>{const e=env as unknown as Record<string,string>;return {key:e.OPENAI_API_KEY,model:e.OPENAI_MODEL}};
async function member(){try{const {member:m}=await identity();return ['admin','logoped'].includes(m.role)?m:null}catch{return null}}
export async function GET(){if(!await member())return json({error:'Yordamchi administrator va logoped uchun.'},403);const c=config();return json({configured:!!(c.key&&c.model)})}
export async function POST(req:Request){
 if(!sameOrigin(req))return json({error:'So‘rov manbasi rad etildi'},403);
 const m=await member();if(!m)return json({error:'Yordamchi administrator va logoped uchun.'},403);
 try{
 const raw=await req.text();if(raw.length>8000)return json({error:'Savol juda uzun.'},413);
 let b:any;try{b=JSON.parse(raw)}catch{return json({error:'So‘rov formati noto‘g‘ri.'},400)}
 if(typeof b.prompt!=='string'||!b.prompt.trim()||b.prompt.length>2000||!['uz','en','ru'].includes(b.language)||b.consent!==true)return json({error:'Savol va yuborishga rozilik talab qilinadi.'},400);
 const c=config();if(!c.key||!c.model)return json({error:'AI hali ulanmagan. Administrator server ulanishini sozlashi kerak.',code:'not_configured'},503);
 const now=Date.now(),db=database();
 // Atomic reservation: no prompts or student records are stored in this table.
 await db.prepare('DELETE FROM ai_requests WHERE created<?').bind(now-86400000).run();
 const reserved=await db.prepare('INSERT INTO ai_requests (id,owner,created) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM ai_requests WHERE owner=? AND created>?)<5 AND (SELECT COUNT(*) FROM ai_requests WHERE owner=? AND created>?)<30').bind(crypto.randomUUID(),m.id,now,m.id,now-60000,m.id,now-86400000).run();
 if(!reserved.meta.changes)return json({error:'So‘rovlar chegarasiga yetdingiz. Keyinroq urinib ko‘ring.'},429);
 const language={uz:'Uzbek Latin',ru:'Russian',en:'English'}[b.language as 'uz'|'en'|'ru'];
 const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+c.key,'Content-Type':'application/json'},signal:AbortSignal.timeout(30000),body:JSON.stringify({model:c.model,store:false,max_output_tokens:1200,instructions:`You are the LOGOPED.UZ educational writing assistant for an adult teacher. Reply concisely in ${language}. Help draft general homework instructions, parent feedback and explain platform use. Never claim you can access student records or send/save work. All output is a draft for the teacher to review. Do not diagnose, recommend treatment, assign grades or infer a child's skill from a prompt. Do not solicit identifying information about children. For clinical decisions ask the adult to consult their qualified speech therapist. Do not invent observations; when missing use clearly labelled placeholders. You have no database or tools.`,input:b.prompt.trim()})});
 if(!response.ok)return json({error:'AI xizmatidan javob olinmadi. Keyinroq qayta urinib ko‘ring.'},502);
 const result:any=await response.json();
 const answer=result.output?.filter((o:any)=>o.type==='message').flatMap((o:any)=>o.content||[]).filter((c:any)=>c.type==='output_text').map((c:any)=>c.text).join('\n');
 if(result.status!=='completed'||!answer)return json({error:'Javob to‘liq tayyorlanmadi. Savolni qisqartirib qayta yuboring.'},502);
 return json({answer});
 }catch{return json({error:'Yordamchiga ulanib bo‘lmadi. Qayta urinib ko‘ring.'},502)}
}
