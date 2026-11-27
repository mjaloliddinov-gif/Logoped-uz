'use client';
import {useEffect,useState} from 'react';
import {Sparkles,Send,Copy,RefreshCw} from 'lucide-react';
import {useLocale} from './Preferences';
import {localize as t} from '../lib/i18n';
import {apiFetch} from '../lib/api-client';
export default function AssistantPanel(){
 const language=useLocale(),[configured,C]=useState<boolean|null>(null),[prompt,P]=useState(''),[answer,A]=useState(''),[busy,B]=useState(false),[error,E]=useState(''),[consent,S]=useState(false),[copied,K]=useState(false);
 async function check(){C(null);E('');try{const d=await apiFetch('/api/assistant');C(d.configured)}catch(e:any){E(e.message)}}
 useEffect(()=>{check()},[]);
 const suggestions=['Uyga vazifa uchun tushunarli ko‘rsatma yozishga yordam ber.','Ota-onaga muloyim izoh uchun to‘ldiriladigan namuna yoz.','Mashg‘ulot rejasining bo‘sh shablonini tayyorla.'];
 return <section className="assistant-panel"><div className="assistant-heading"><div className="assistant-orb"><Sparkles size={34}/></div><div><span className="eyebrow">LOGOPED.UZ</span><h2>{t('AI yordamchi')}</h2><p>{t('Vazifa va izoh uchun qoralama tayyorlash.')}</p></div><span className="badge">{t(configured===null?'Tekshirilmoqda…':configured?'Ulangan':'Hali ulanmagan')}</span></div>
 {configured===false&&<div className="notice"><strong>{t('AI xizmati hali ulanmagan.')}</strong><p>{t('Ulanish faollashgach, bu yerda savol yuborib javob olishingiz mumkin. Hozir AI javoblari yaratilmaydi.')}</p><button className="secondary" onClick={check}><RefreshCw size={16}/>{t('Qayta tekshirish')}</button></div>}
 <div className="assistant-suggestions">{suggestions.map(s=><button type="button" className="secondary" key={s} onClick={()=>P(t(s))}>{t(s)}</button>)}</div>
 <form onSubmit={async e=>{e.preventDefault();if(busy)return;B(true);E('');A('');K(false);try{const d=await apiFetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,language,consent})});A(d.answer)}catch(e:any){E(e.message)}finally{B(false)}}}>
 <label>{t('Savolingiz')}<textarea value={prompt} onChange={e=>P(e.target.value)} rows={5} maxLength={2000} required placeholder={t('Mavzu, yosh guruhi va qanday qoralama kerakligini yozing.')}/></label><small>{prompt.length} / 2000</small>
 <p className="assistant-privacy">{t('Bolaning ismi, tashxisi yoki shaxsiy ma’lumotlarini yozmang. Faqat kiritilgan savol OpenAI xizmatiga yuboriladi; o‘quvchilar yozuvlari avtomatik yuborilmaydi.')}</p>
 <label className="check"><input type="checkbox" checked={consent} onChange={e=>S(e.target.checked)}/>{t('Savolni AI xizmatiga yuborishga roziman.')}</label>
 <button className="primary" disabled={!configured||busy||!consent||!prompt.trim()}><Send size={17}/>{t(busy?'Javob tayyorlanmoqda…':'Yordamchidan so‘rash')}</button></form>
 {error&&<p className="auth-error" role="alert">{t(error)}</p>}
 {answer&&<article className="assistant-answer" aria-live="polite"><div><h3>{t('Tekshirish uchun qoralama')}</h3><button className="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(answer);K(true)}catch{E('Nusxalash amalga oshmadi. Matnni belgilang va nusxalang.')}}}><Copy size={16}/>{t(copied?'Nusxalandi':'Nusxalash')}</button></div><p>{answer}</p><small>{t('AI xato qilishi mumkin. Matnni tekshiring; baho, izoh yoki vazifa avtomatik saqlanmaydi.')}</small></article>}
 </section>
}
