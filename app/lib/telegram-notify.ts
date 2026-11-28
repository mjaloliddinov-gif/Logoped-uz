import 'server-only';
import {siteOrigin} from './auth-config';
import {botToken,setting,telegram} from './telegram';
// Mirrors in-site notifications to the Telegram chats of people who registered through the bot.
export const esc=(v:unknown,n=700)=>{const s=String(v??'').trim();return (s.length>n?s.slice(0,n)+'…':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')};
async function chatOf(userId:string):Promise<number|null>{try{const p=await setting('profile:'+userId);const id=Number(p?.telegram?.id);return Number.isSafeInteger(id)&&id>0?id:null}catch{return null}}
/** Best effort: never throws and never delays a request by more than a few seconds. */
export async function telegramPush(userIds:(string|null|undefined)[],html:string,options:{button?:boolean}={}){
 if(!botToken())return;
 const ids=[...new Set(userIds.filter((x):x is string=>typeof x==='string'&&!!x))];if(!ids.length)return;
 const site=siteOrigin(),markup=options.button!==false&&site?{reply_markup:{inline_keyboard:[[{text:'🌐 Saytda ochish',url:site+'/#Kabinet'}]]}}:{};
 const send=async(id:string)=>{const chat=await chatOf(id);if(!chat)return;await telegram('sendMessage',{chat_id:chat,text:html.slice(0,4000),parse_mode:'HTML',disable_web_page_preview:true,...markup})};
 const timeout=new Promise(r=>setTimeout(r,6000));
 await Promise.race([Promise.allSettled(ids.map(send)),timeout]);
}
const statusIcon:Record<string,string>={'Boshlanmagan':'⚪','Mashq qilinmoqda':'🟡','O‘zlashtirilgan':'🟢'};
/** Human message for a record that was created or updated for a pupil. */
export function describeRecord(kind:string,data:any,pupilName:string,actorIsStaff:boolean):string|null{
 const who=' — <b>'+esc(pupilName,80)+'</b>';
 if(kind==='task'){
  if(!actorIsStaff){const done=data.status==='Bajarildi';return (done?'✅ <b>Vazifa bajarildi</b>':'🔄 <b>Vazifa holati yangilandi</b>')+who+'\n\n<b>'+esc(data.title,200)+'</b>\nHolati: '+esc(data.status,40)+(data.answer?'\n\n💬 Javob: '+esc(data.answer,800):'')}
  if(data.status==='Logoped tekshirdi')return '✅ <b>Vazifa tekshirildi</b>'+who+'\n\n<b>'+esc(data.title,200)+'</b>'+(data.reviewComment?'\n\n💬 Logoped izohi: '+esc(data.reviewComment,800):'');
  return '📝 <b>Uyga vazifa</b>'+who+'\n\n<b>'+esc(data.title,200)+'</b>'+(data.body?'\n'+esc(data.body,900):'')+(data.due?'\n\n⏰ Muddat: '+esc(data.due,20):'')+(data.minutes?'\n⏱ Taxminan '+esc(data.minutes,4)+' daqiqa':'');
 }
 if(kind==='note')return '💬 <b>Logopeddan izoh</b>'+who+'\n\n<b>'+esc(data.title,200)+'</b>\n'+esc(data.body,1500);
 if(kind==='grade')return '⭐ <b>Yangi baho</b>'+who+'\n\n<b>'+esc(data.title,200)+'</b>: '+esc(data.score,2)+' / 5'+(data.criteria?'\nMezon: '+esc(data.criteria,300):'')+(data.comment?'\n\n💬 '+esc(data.comment,800):'');
 if(kind==='session')return '📅 <b>Mashg‘ulot</b>'+who+'\n\n<b>'+esc(data.title,200)+'</b>\n🗓 '+esc(data.date,20)+(data.time?' · '+esc(data.time,10):'')+(data.status?'\nHolati: '+esc(data.status,40):'')+(data.body?'\n'+esc(data.body,600):'');
 if(kind==='observation')return '📊 <b>Kuzatuv natijasi</b>'+who+'\n\n'+(data.title?esc(data.title,200)+': ':'')+esc(data.correct,6)+' / '+esc(data.total,6)+' to‘g‘ri';
 if(kind==='skill')return '🔤 <b>Tovush ko‘nikmasi</b>'+who+'\n\n«'+esc(data.sound,10)+'» tovushi: '+(statusIcon[data.status]||'')+' '+esc(data.status,40);
 return null;
}
