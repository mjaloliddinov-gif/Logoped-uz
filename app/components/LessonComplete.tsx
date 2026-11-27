'use client';
import {useState} from 'react';
import {Check,BookOpen} from 'lucide-react';
import {localize as t} from '../lib/i18n';
import {useLocale} from './Preferences';
import {apiFetch} from '../lib/api-client';
export default function LessonComplete({lesson,students,refresh,openHomework}:any){
 useLocale();const [student,S]=useState(students.length===1?students[0].id:''),[busy,B]=useState(false),[error,E]=useState(''),[done,D]=useState(false);
 return <section className="lesson-complete"><h3><BookOpen size={20}/>{t('Darsdan keyingi uy vazifasi')}</h3><p>{t('Darsni tugatganingizni belgilang. Shu mavzudagi uy vazifasi kabinetga avtomatik tushadi.')}</p>{students.length>0?<><label>{t('O‘quvchi')}<select value={student} disabled={busy} onChange={e=>{S(e.target.value);D(false);E('')}}><option value="">{t('Tanlang')}</option>{students.map((s:any)=><option value={s.id} key={s.id}>{s.data.name}</option>)}</select></label><button className="primary" disabled={!student||busy||done} onClick={async()=>{B(true);E('');try{await apiFetch('/api/lessons',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lesson:lesson.id,student})});D(true);await refresh()}catch(e:any){E(e.message)}finally{B(false)}}}><Check size={18}/>{t(busy?'Saqlanmoqda…':done?'Dars tugatildi':'Darsni tugatdim')}</button>{done&&<div role="status"><p>{t('Uy vazifasi tayyor. Uni kabinetda bajarishingiz mumkin.')}</p><button className="secondary" onClick={openHomework}>{t('Uy vazifasini ochish')}</button></div>}</>:<p className="notice">{t('Natija va uy vazifasini saqlash uchun hisobga kiring va o‘quvchi profilini bog‘lang.')}</p>}{error&&<p className="auth-error" role="alert">{t(error)}</p>}<small>{t('Har bir dars uchun bir o‘quvchiga bir kunda bitta avtomatik vazifa yaratiladi. Muddat — keyingi kun.')}</small></section>
}
