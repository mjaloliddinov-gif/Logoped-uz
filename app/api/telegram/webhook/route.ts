import {database} from '../../../lib/postgres';
import {siteOrigin} from '../../../lib/auth-config';
import {CODE_MINUTES,adminAuth,dropSetting,equalText,issueCode,putSetting,setting,telegram,telegramEmail,webhookSecret} from '../../../lib/telegram';
import {acceptInvite,findInvite,validInviteToken} from '../../../lib/invite-accept';
export const dynamic='force-dynamic';
// Everything about an account happens here: registration, role checks, invites, approvals and sign-in codes.
const ok=()=>new Response('ok',{headers:{'Cache-Control':'no-store'}});
const CODE_BUTTON='🔑 Kirish kodi';
const mainKeyboard={keyboard:[[{text:CODE_BUTTON}]],resize_keyboard:true,is_persistent:true};
const clean=(v:unknown,n:number)=>String(v??'').replace(/[\u0000-\u001F\u007F<>&]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const db=database;
async function say(chat:number,text:string,extra:Record<string,unknown>={}){return telegram('sendMessage',{chat_id:chat,text,parse_mode:'HTML',disable_web_page_preview:true,...extra})}
async function sendCode(chat:number,user:{id:string;email:string},greeting=''){
 const code=await issueCode(user),site=siteOrigin();
 const text=(greeting?greeting+'\n\n':'')+'🔑 Saytga kirish kodingiz: <b>'+code+'</b>\n\nKod '+CODE_MINUTES+' daqiqa amal qiladi va faqat bir marta ishlaydi. Uni hech kimga bermang.';
 await say(chat,text,site?{reply_markup:{inline_keyboard:[[{text:'🌐 Saytga kirish',url:site+'/login?code='+code}]]}}:{reply_markup:mainKeyboard});
 if(site)await say(chat,'Yangi kod kerak bo‘lsa, pastdagi «'+CODE_BUTTON+'» tugmasini bosing.',{reply_markup:mainKeyboard});
}
const PARENT='👨‍👩‍👧 Ota-ona',STUDENT='🧒 O‘quvchi',LOGOPED='🩺 Logoped';
type Role='parent'|'student'|'logoped';
const roleKeyboard={reply_markup:{keyboard:[[{text:PARENT}],[{text:STUDENT}],[{text:LOGOPED}]],resize_keyboard:true,one_time_keyboard:true}};
const roleOf=(v:unknown):Role=>v==='logoped'?'logoped':v==='student'?'student':'parent';
const ROLE_NAMES:Record<string,string>={admin:'administrator',logoped:'logoped',parent:'ota-ona',student:'o‘quvchi'};
const memberOf=async(id:string)=>db.prepare('SELECT * FROM members WHERE id=?').bind(id).first<{id:string;email:string;role:string}>();
/** Who approves logopeds: administrators who use the bot, plus chats listed in settings.telegram_approvers. */
async function approverChats():Promise<number[]>{
 const ids=new Set<number>();
 const listed=await setting('telegram_approvers').catch(()=>null);for(const v of listed?.ids||[])if(Number.isSafeInteger(Number(v)))ids.add(Number(v));
 const admins=(await db.prepare("SELECT id FROM members WHERE role='admin'").all<{id:string}>()).results;
 for(const a of admins){const p=await setting('profile:'+a.id).catch(()=>null);if(Number.isSafeInteger(Number(p?.telegram?.id))&&Number(p.telegram.id)>0)ids.add(Number(p.telegram.id))}
 return [...ids];
}
/** "Siz logoped sifatida kirasiz" — every code says which cabinet it opens. */
async function roleLine(userId:string){
 const member=await memberOf(userId).catch(()=>null);
 const profile=await setting('profile:'+userId).catch(()=>null),name=clean(profile?.name,80);
 const hello='Assalomu alaykum'+(name?', <b>'+name+'</b>':'')+'!';
 if(member?.role&&ROLE_NAMES[member.role])return hello+'\nSiz <b>'+ROLE_NAMES[member.role]+'</b> sifatida kirasiz.';
 if(profile?.requestedRole==='logoped')return hello+'\nSiz <b>logoped</b> sifatida ro‘yxatdan o‘tgansiz. Administrator tasdiqlashi kutilmoqda.';
 if(profile?.requestedRole==='student')return hello+'\nSiz <b>o‘quvchi</b> sifatida ro‘yxatdan o‘tgansiz. Logopedingiz yuborgan taklif havolasini oching — shu bilan kabinetingiz ochiladi.';
 return hello;
}
async function register(from:any,name:string,phone:string,role:Role){
 const admin=adminAuth(),email=telegramEmail(from.id),now=new Date().toISOString();
 let userId:string|undefined;
 const created=await admin.createUser({email,email_confirm:true,user_metadata:{name,telegram_id:from.id,phone,requestedRole:role}});
 if(created.data?.user)userId=created.data.user.id;
 else{const link=await admin.generateLink({type:'magiclink',email});userId=link.data?.user?.id;if(!userId)throw Error('user_not_created');}
 await db.batch([
  // Parents are active at once. A student becomes active through a logoped's invite; a logoped after approval.
  db.prepare('INSERT INTO members VALUES (?,?,?) ON CONFLICT(id) DO NOTHING').bind(userId,email,role==='parent'?'parent':'pending'),
  putSetting('profile:'+userId,{name,phone,requestedRole:role,telegram:{id:from.id,username:clean(from.username,64)||undefined},submittedAt:now}),
  putSetting('tg:'+from.id,{user:userId,email}),
  dropSetting('tgstate:'+from.id),
  db.prepare('INSERT INTO audit VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),userId,'telegram_registration',userId,now),
 ]);
 return {id:userId,email};
}
async function askApproval(user:{id:string},name:string,phone:string,username?:string){
 const now=new Date().toISOString();
 const admins=(await db.prepare("SELECT id FROM members WHERE role='admin'").all<{id:string}>()).results;
 if(admins.length)await db.batch(admins.map(a=>db.prepare("INSERT INTO notifications VALUES (?,?,?,?,'0')").bind(crypto.randomUUID(),a.id,'Yangi logoped so‘rovi: '+name+' ('+phone+')',now)));
 const text='🩺 <b>Yangi logoped so‘rovi</b>\n\nIsm: <b>'+name+'</b>\nTelefon: '+phone+(username?'\nTelegram: @'+username:'')+'\n\nUshbu odam logoped ekanini tasdiqlaysizmi?';
 const markup={reply_markup:{inline_keyboard:[[{text:'✅ Tasdiqlash',callback_data:'ap:'+user.id},{text:'❌ Rad etish',callback_data:'rj:'+user.id}]]}};
 for(const chat of await approverChats()){try{await say(chat,text,markup)}catch{}}
}
async function linkedUser(telegramId:number){const l=await setting('tg:'+telegramId);return l?{id:String(l.user),email:String(l.email)}:null}
async function onApproval(q:any){
 const answer=(text:string)=>telegram('answerCallbackQuery',{callback_query_id:q.id,text,show_alert:false}).catch(()=>{});
 if(!(await approverChats()).includes(Number(q.from?.id))){await answer('Sizda tasdiqlash huquqi yo‘q');return}
 const [action,userId]=String(q.data||'').split(':');
 if(!['ap','rj'].includes(action)||!userId){await answer('Noma’lum amal');return}
 const member=await memberOf(userId),profile=await setting('profile:'+userId).catch(()=>null);
 if(!member||profile?.requestedRole!=='logoped'){await answer('So‘rov topilmadi');return}
 const now=new Date().toISOString(),name=clean(profile.name,80),approver=await linkedUser(Number(q.from.id));
 let result:string;
 if(action==='ap'){
  if(member.role!=='pending'&&member.role!=='logoped'){await answer('Bu hisobning roli boshqa');return}
  await db.batch([db.prepare("UPDATE members SET role='logoped' WHERE id=? AND role IN ('pending','logoped')").bind(userId),db.prepare("INSERT INTO notifications VALUES (?,?,?,?,'0')").bind(crypto.randomUUID(),userId,'Hisobingiz tasdiqlandi',now),db.prepare('INSERT INTO audit VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),approver?.id||'telegram:'+q.from.id,'role',userId,now)]);
  result='✅ Tasdiqlandi: '+name+' endi logoped.';
  const chat=Number(profile?.telegram?.id);if(chat>0)await sendCode(chat,{id:userId,email:member.email},'✅ <b>Hisobingiz tasdiqlandi!</b>\nSiz <b>logoped</b> sifatida kirasiz.');
 }else{
  await db.batch([putSetting('profile:'+userId,{...profile,requestedRole:'rejected',rejectedAt:now}),db.prepare('INSERT INTO audit VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),approver?.id||'telegram:'+q.from.id,'role_rejected',userId,now)]);
  result='❌ Rad etildi: '+name+'.';
  const chat=Number(profile?.telegram?.id);if(chat>0)await say(chat,'Afsuski, logoped sifatidagi so‘rovingiz tasdiqlanmadi. Savollar bo‘lsa, administrator bilan bog‘laning.');
 }
 await answer(result);
 if(q.message?.chat?.id&&q.message?.message_id)await telegram('editMessageText',{chat_id:q.message.chat.id,message_id:q.message.message_id,text:clean(q.message.text,900)+'\n\n'+result}).catch(()=>{});
}
async function joinByInvite(chat:number,user:{id:string;email:string},token:string){
 const member=await memberOf(user.id);if(!member)throw Error('member_missing');
 const r=await acceptInvite(db as any,member,token);
 if(!r.ok){await say(chat,'⚠️ '+r.error+'.',{reply_markup:mainKeyboard});return}
 await sendCode(chat,user,'✅ <b>'+clean(r.studentName,80)+'</b> profiliga ulandingiz!\nSiz <b>'+(ROLE_NAMES[r.role]||r.role)+'</b> sifatida kirasiz. Vazifalar, izohlar va baholar shu botga keladi.');
}
export async function POST(req:Request){
 const secret=webhookSecret(),given=req.headers.get('x-telegram-bot-api-secret-token')||'';
 if(!secret||!equalText(given,secret))return new Response('forbidden',{status:403});
 let update:any;try{update=await req.json()}catch{return ok()}
 if(update?.callback_query){try{await onApproval(update.callback_query)}catch(e){console.error('[telegram] approval failed:',e instanceof Error?e.message.slice(0,80):'error')}return ok()}
 const m=update?.message;
 if(!m||m.chat?.type!=='private'||!m.from||m.from.is_bot)return ok();
 const chat=m.chat.id,from=m.from,text=typeof m.text==='string'?m.text.trim():'';
 const payload=text.startsWith('/start ')?text.slice(7).trim():'',inviteToken=payload.startsWith('inv_')?payload.slice(4):'';
 try{
  const linked=await linkedUser(from.id);
  if(linked){
   if(inviteToken)await joinByInvite(chat,linked,inviteToken);
   else if(text.startsWith('/start')||text==='/kod'||text===CODE_BUTTON)await sendCode(chat,linked,await roleLine(linked.id));
   else await say(chat,'Saytga kirish uchun «'+CODE_BUTTON+'» tugmasini bosing.',{reply_markup:mainKeyboard});
   return ok();
  }
  const state=await setting('tgstate:'+from.id);
  if(inviteToken){
   const invite=validInviteToken(inviteToken)?await findInvite(db as any,inviteToken):null;
   if(!invite||invite.status!=='pending'||invite.expires<new Date().toISOString()){await say(chat,'⚠️ Bu taklif havolasi yaroqsiz yoki muddati tugagan. Logopeddan yangi havola so‘rang.');return ok()}
   const student=await db.prepare("SELECT data FROM records WHERE id=? AND kind='student'").bind(invite.student).first<{data:string}>();
   const childName=clean(student?JSON.parse(student.data).name:'',80);
   await putSetting('tgstate:'+from.id,{step:'name',role:invite.role==='student'?'student':'parent',invite:inviteToken}).run();
   await say(chat,'Assalomu alaykum! Siz <b>'+(childName||'o‘quvchi')+'</b> uchun <b>'+(invite.role==='student'?'o‘quvchi':'ota-ona')+'</b> sifatida taklif qilindingiz.\n\nRo‘yxatdan o‘tish uchun <b>ismingiz va familiyangizni</b> yozing.',{reply_markup:{remove_keyboard:true}});
   return ok();
  }
  if(text.startsWith('/start')||!state){
   await putSetting('tgstate:'+from.id,{step:'role'}).run();
   await say(chat,'Assalomu alaykum! <b>LOGOPED.UZ</b> ga xush kelibsiz.\n\n<b>Siz kimsiz?</b> Pastdagi tugmalardan birini bosing:\n\n'+PARENT+' — farzandingizning vazifa va baholarini kuzatasiz\n'+STUDENT+' — logoped bergan mashqlarni bajarasiz\n'+LOGOPED+' — o‘quvchilar bilan ishlaysiz (administrator tasdiqlaydi)',roleKeyboard);
   return ok();
  }
  if(state.step==='role'){
   const role=text===PARENT?'parent':text===STUDENT?'student':text===LOGOPED?'logoped':null;
   if(!role){await say(chat,'Iltimos, pastdagi tugmalardan birini bosing: «'+PARENT+'», «'+STUDENT+'» yoki «'+LOGOPED+'».',roleKeyboard);return ok()}
   await putSetting('tgstate:'+from.id,{step:'name',role}).run();
   await say(chat,'Ro‘yxatdan o‘tish uchun <b>ismingiz va familiyangizni</b> yozing.\nMasalan: <i>Dilnoza Karimova</i>',{reply_markup:{remove_keyboard:true}});
   return ok();
  }
  if(state.step==='name'){
   const name=clean(text,80);
   if(name.length<2||text.startsWith('/')){await say(chat,'Iltimos, ismingiz va familiyangizni matn bilan yozing.');return ok()}
   await putSetting('tgstate:'+from.id,{...state,step:'phone',name,role:roleOf(state.role)}).run();
   await say(chat,'Rahmat, <b>'+name+'</b>!\n\nEndi pastdagi tugmani bosib, <b>telefon raqamingizni</b> yuboring. '+(state.role==='logoped'?'Administrator sizni shu raqam orqali taniydi.':'Logoped sizni shu raqam orqali taniydi.'),{reply_markup:{keyboard:[[{text:'📱 Telefon raqamni yuborish',request_contact:true}]],resize_keyboard:true,one_time_keyboard:true}});
   return ok();
  }
  if(state.step==='phone'){
   const c=m.contact;
   if(!c||c.user_id!==from.id){await say(chat,'Iltimos, pastdagi «📱 Telefon raqamni yuborish» tugmasini bosing. Faqat o‘zingizning raqamingiz qabul qilinadi.');return ok()}
   const phone=clean(c.phone_number,20).replace(/[^\d+]/g,''),role=roleOf(state.role),name=clean(state.name,80);
   const user=await register(from,name,phone,role);
   if(state.invite){await joinByInvite(chat,user,String(state.invite));return ok()}
   if(role==='logoped'){
    await askApproval(user,name,phone,clean(from.username,64)||undefined);
    await say(chat,'✅ So‘rovingiz qabul qilindi — siz <b>logoped</b> sifatida ro‘yxatdan o‘tdingiz!\n\nAdministrator tasdiqlagach, shu yerga xabar va kirish kodi keladi.',{reply_markup:mainKeyboard});
   }else if(role==='student')await sendCode(chat,user,'✅ Ro‘yxatdan o‘tdingiz — siz <b>o‘quvchi</b>siz!\n\nLogopedingizdan <b>taklif havolasini</b> so‘rang va uni oching. Shundan keyin vazifalaringiz va baholaringiz shu botga keladi.');
   else await sendCode(chat,user,'✅ Ro‘yxatdan o‘tdingiz — siz <b>ota-ona</b>siz!\n\nLogoped yuborgan taklif havolasini oching. Shundan keyin farzandingizning uyga vazifalari, izohlari va baholari shu botga keladi.');
   return ok();
  }
  await dropSetting('tgstate:'+from.id).run();
  await say(chat,'Qaytadan boshlash uchun /start ni bosing.');
 }catch(e){
  console.error('[telegram] update failed:',e instanceof Error?e.message.slice(0,80):'error');
  try{await say(chat,'Kechirasiz, xatolik yuz berdi. Birozdan keyin /start ni bosing.')}catch{}
 }
 return ok();
}
