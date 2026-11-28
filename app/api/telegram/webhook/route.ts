import {database} from '../../../lib/postgres';
import {siteOrigin} from '../../../lib/auth-config';
import {CODE_MINUTES,adminAuth,dropSetting,equalText,issueCode,putSetting,setting,telegram,telegramEmail,webhookSecret} from '../../../lib/telegram';
export const dynamic='force-dynamic';
const ok=()=>new Response('ok',{headers:{'Cache-Control':'no-store'}});
const CODE_BUTTON='🔑 Kirish kodi';
const mainKeyboard={keyboard:[[{text:CODE_BUTTON}]],resize_keyboard:true,is_persistent:true};
const clean=(v:unknown,n:number)=>String(v??'').replace(/[\u0000-\u001F\u007F<>&]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
async function say(chat:number,text:string,extra:Record<string,unknown>={}){await telegram('sendMessage',{chat_id:chat,text,parse_mode:'HTML',disable_web_page_preview:true,...extra})}
async function sendCode(chat:number,user:{id:string;email:string},greeting=''){
 const code=await issueCode(user),site=siteOrigin();
 const text=(greeting?greeting+'\n\n':'')+'Saytga kirish kodingiz: <b>'+code+'</b>\n\nKod '+CODE_MINUTES+' daqiqa amal qiladi va faqat bir marta ishlaydi. Uni hech kimga bermang.';
 await say(chat,text,site?{reply_markup:{inline_keyboard:[[{text:'🌐 Saytga kirish',url:site+'/login?code='+code}]]}}:{reply_markup:mainKeyboard});
 if(site)await say(chat,'Yangi kod kerak bo‘lsa, pastdagi «'+CODE_BUTTON+'» tugmasini bosing.',{reply_markup:mainKeyboard});
}
async function register(from:any,name:string,phone:string){
 const admin=adminAuth(),email=telegramEmail(from.id),now=new Date().toISOString();
 let userId:string|undefined;
 const created=await admin.createUser({email,email_confirm:true,user_metadata:{name,telegram_id:from.id,phone}});
 if(created.data?.user)userId=created.data.user.id;
 else{const link=await admin.generateLink({type:'magiclink',email});userId=link.data?.user?.id;if(!userId)throw Error('user_not_created');}
 const db=database;
 await db.batch([
  db.prepare("INSERT INTO members VALUES (?,?,'parent') ON CONFLICT(id) DO NOTHING").bind(userId,email),
  putSetting('profile:'+userId,{name,phone,requestedRole:'parent',telegram:{id:from.id,username:clean(from.username,64)||undefined},submittedAt:now}),
  putSetting('tg:'+from.id,{user:userId,email}),
  dropSetting('tgstate:'+from.id),
  db.prepare('INSERT INTO audit VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),userId,'telegram_registration',userId,now),
 ]);
 return {id:userId,email};
}
export async function POST(req:Request){
 const secret=webhookSecret(),given=req.headers.get('x-telegram-bot-api-secret-token')||'';
 if(!secret||!equalText(given,secret))return new Response('forbidden',{status:403});
 let update:any;try{update=await req.json()}catch{return ok()}
 const m=update?.message;
 if(!m||m.chat?.type!=='private'||!m.from||m.from.is_bot)return ok();
 const chat=m.chat.id,from=m.from,text=typeof m.text==='string'?m.text.trim():'';
 try{
  const link=await setting('tg:'+from.id),linked=link?{id:String(link.user),email:String(link.email)}:null;
  if(linked){
   if(text.startsWith('/start')||text==='/kod'||text===CODE_BUTTON)await sendCode(chat,linked,text.startsWith('/start')?'Assalomu alaykum! Siz ro‘yxatdan o‘tgansiz.':'');
   else await say(chat,'Saytga kirish uchun «'+CODE_BUTTON+'» tugmasini bosing.',{reply_markup:mainKeyboard});
   return ok();
  }
  const state=await setting('tgstate:'+from.id);
  if(text.startsWith('/start')||!state){
   await putSetting('tgstate:'+from.id,{step:'name'}).run();
   await say(chat,'Assalomu alaykum! <b>LOGOPED.UZ</b> ga xush kelibsiz.\n\nRo‘yxatdan o‘tish uchun <b>ismingiz va familiyangizni</b> yozing.\nMasalan: <i>Dilnoza Karimova</i>',{reply_markup:{remove_keyboard:true}});
   return ok();
  }
  if(state.step==='name'){
   const name=clean(text,80);
   if(name.length<2||text.startsWith('/')){await say(chat,'Iltimos, ismingiz va familiyangizni matn bilan yozing.');return ok()}
   await putSetting('tgstate:'+from.id,{step:'phone',name}).run();
   await say(chat,'Rahmat, <b>'+name+'</b>!\n\nEndi pastdagi tugmani bosib, <b>telefon raqamingizni</b> yuboring. Logoped sizni shu raqam orqali taniydi.',{reply_markup:{keyboard:[[{text:'📱 Telefon raqamni yuborish',request_contact:true}]],resize_keyboard:true,one_time_keyboard:true}});
   return ok();
  }
  if(state.step==='phone'){
   const c=m.contact;
   if(!c||c.user_id!==from.id){await say(chat,'Iltimos, pastdagi «📱 Telefon raqamni yuborish» tugmasini bosing. Faqat o‘zingizning raqamingiz qabul qilinadi.');return ok()}
   const phone=clean(c.phone_number,20).replace(/[^\d+]/g,'');
   const user=await register(from,clean(state.name,80),phone);
   await sendCode(chat,user,'✅ Ro‘yxatdan o‘tdingiz!');
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
