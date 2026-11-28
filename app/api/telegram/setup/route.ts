import {json} from '../../../lib/server';
import {siteOrigin} from '../../../lib/auth-config';
import {botToken,equalText,putSetting,telegram,webhookSecret} from '../../../lib/telegram';
export const dynamic='force-dynamic';
// Connects the bot to this site. Protected by TELEGRAM_WEBHOOK_SECRET; safe to call again after a domain or token change.
export async function GET(req:Request){
 const secret=webhookSecret(),key=new URL(req.url).searchParams.get('key')||'';
 if(!secret||!equalText(key,secret))return json({error:'forbidden'},403);
 if(!botToken())return json({error:'TELEGRAM_BOT_TOKEN sozlanmagan'},503);
 const site=siteOrigin();if(!site)return json({error:'NEXT_PUBLIC_SITE_URL sozlanmagan'},503);
 try{
  const me=await telegram('getMe',{});
  await telegram('setWebhook',{url:site+'/api/telegram/webhook',secret_token:secret,allowed_updates:['message','callback_query'],drop_pending_updates:true});
  await telegram('setMyCommands',{commands:[{command:'start',description:'Ro‘yxatdan o‘tish'},{command:'kod',description:'Saytga kirish kodi'}]});
  await telegram('setMyDescription',{description:'LOGOPED.UZ — logoped, bola va ota-onani bog‘laydigan platforma. Shu yerda ro‘yxatdan o‘ting va saytga kirish kodini oling.'});
  await putSetting('telegram_bot',{username:me.username}).run();
  return json({ok:true,username:me.username,webhook:site+'/api/telegram/webhook'});
 }catch(e){return json({error:e instanceof Error?e.message:'telegram_error'},502)}
}
