'use client';
import {useEffect,useState} from 'react';
import {Headphones,ArrowLeft,ArrowRight,ShieldCheck,KeyRound,Send} from 'lucide-react';
import {apiFetch} from '../lib/api-client';
import {localize as t} from '../lib/i18n';
import {useLocale} from './Preferences';
// The site only signs people in. Registration, roles and approvals all happen in the Telegram bot.
export default function AuthPanel(_:{mode?:'login'|'signup'}){
 useLocale();
 const [state,S]=useState<any>(null),[loading,L]=useState(true),[busy,B]=useState(false),[message,M]=useState(''),[error,E]=useState(''),[bot,BOT]=useState<string|null>(null),[code,C]=useState(''),[admin,AD]=useState(false),[recover,R]=useState(false);
 async function refresh(){const d=await apiFetch('/api/auth/status');S(d.me?d:null);if(d.me?.role&&d.me.role!=='pending')location.replace(d.me.role==='admin'?'/admin':sessionStorage.getItem('logoped_invite')?'/invite':'/#Kabinet');return d}
 useEffect(()=>{
  refresh().catch(e=>E(e.message)).finally(()=>L(false));
  const q=new URLSearchParams(location.search);
  if(q.get('error'))E('Havola yaroqsiz yoki muddati tugagan.');
  if(q.get('admin'))AD(true);
  fetch('/api/telegram/info').then(r=>r.ok?r.json():null).then(d=>BOT(d?.username||null)).catch(()=>{});
  const given=(q.get('code')||'').replace(/\D/g,'');if(given.length===6){C(given);history.replaceState(null,'',location.pathname);telegramLogin(given)}
 },[]);
 async function telegramLogin(value:string){const v=value.replace(/\D/g,'');if(v.length!==6){E('6 xonali kodni kiriting');return}B(true);E('');M('');try{await apiFetch('/api/auth/telegram',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:v})});M('Kirish muvaffaqiyatli…');await refresh()}catch(e:any){E(e.message);C('')}finally{B(false)}}
 async function adminSubmit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;B(true);E('');M('');const f=Object.fromEntries(new FormData(e.currentTarget));try{const d=await apiFetch('/api/auth/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:recover?'recover':'login',email:f.email,password:f.password})});if(recover)M(d.message);else await refresh()}catch(e:any){E(e.message)}finally{B(false)}}
 const botUrl=bot?'https://t.me/'+bot+'?start=login':null;
 return <main className="auth-page"><aside className="auth-story"><a className="auth-brand" href="/"><Headphones size={30}/> LOGOPED.UZ</a><div><span className="auth-kicker">{t('BIR JAMOA. BITTA MAQSAD.')}</span><h1>{t('Har bir so‘z —')}<br/>{t('yangi imkoniyat.')}</h1><p>{t('Logoped, bola va ota-onani bog‘laydigan')}<br/>{t('mehrli ta’lim muhiti.')}</p><img src="/logoped-u-session.webp" decoding="async" alt={t('Logoped va bola U tovushini mashq qilmoqda')}/></div><small>{t('Nutqni rivojlantiramiz. Imkoniyatlarni kengaytiramiz.')}</small></aside>
 <section className="auth-content"><a className="auth-back" href="/"><ArrowLeft size={17}/>{t('Bosh sahifa')}</a><div className="auth-box">
  <div className="auth-lock"><KeyRound size={27}/></div>
  <h2>{t(admin?'Administrator kirishi':'Kirish')}</h2>
  {loading?<p role="status">{t('Tekshirilmoqda…')}</p>:state?<div className="code-login"><p className="notice" role="status">{t(state.me?.profile?.requestedRole==='logoped'?'Logoped so‘rovingiz administratorga yuborilgan. Tasdiqlangach, Telegram botga xabar keladi.':'Hisobingiz hali faollashtirilmagan. Logopedingiz yuborgan taklif havolasini Telegram’da oching.')}</p><a href="/logout" className="text-button">{t('Chiqish')}</a></div>
  :!admin?<div className="code-login">
   <p className="code-lead">{t('Telegram botdan olgan 6 xonali kodingizni yozing.')}</p>
   <form className="telegram-code" onSubmit={e=>{e.preventDefault();telegramLogin(code)}}><input aria-label={t('6 xonali kod')} inputMode="numeric" autoComplete="one-time-code" autoFocus pattern="[0-9 ]*" maxLength={7} placeholder="123456" value={code} onChange={e=>C(e.target.value.replace(/[^\d]/g,'').slice(0,6))}/><button className="primary" disabled={busy||code.length!==6}>{t(busy?'Tekshirilmoqda…':'Kirish')}<ArrowRight size={18}/></button></form>
   {error&&<p className="auth-error" role="alert">{t(error)}</p>}{message&&<p className="notice" role="status">{t(message)}</p>}
   <div className="code-help"><strong>{t('Kodingiz yo‘qmi?')}</strong><p>{t('Telegram botni oching. Bot siz ota-ona, o‘quvchi yoki logoped ekaningizni tekshiradi va kod beradi. Ro‘yxatdan o‘tish ham shu yerda.')}</p>{botUrl&&<><a className="primary telegram-button" href={botUrl} target="_blank" rel="noopener noreferrer"><Send size={18}/>{t('Telegram botni ochish')}</a><a className="telegram-link" href={botUrl} target="_blank" rel="noopener noreferrer">t.me/{bot}</a></>}</div>
  </div>
  :<form className="auth-form" onSubmit={adminSubmit}><label>{t('Elektron pochta')}<input name="email" type="email" autoComplete="email" required maxLength={200}/></label>{!recover&&<label>{t('Parol')}<input name="password" type="password" autoComplete="current-password" required minLength={12} maxLength={128}/></label>}{error&&<p className="auth-error" role="alert">{t(error)}</p>}{message&&<p className="notice" role="status">{t(message)}</p>}<button className="primary auth-submit" disabled={busy}>{t(busy?'Tekshirilmoqda…':recover?'Tiklash havolasini yuborish':'Kirish')}<ArrowRight size={18}/></button><button type="button" className="text-button" onClick={()=>{R(!recover);E('');M('')}}>{t(recover?'Kirishga qaytish':'Parolni unutdingizmi?')}</button><button type="button" className="text-button" onClick={()=>{AD(false);R(false);E('');M('')}}>{t('Kod bilan kirishga qaytish')}</button></form>}
  {!admin&&!state&&<button type="button" className="admin-entry-link" onClick={()=>{AD(true);E('');M('')}}><ShieldCheck size={17}/>{t('Administrator')}</button>}
 </div></section></main>
}
