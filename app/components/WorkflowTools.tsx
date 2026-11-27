'use client';
import {ChatPanel} from './ChatPanel';
import {localize} from '../lib/i18n';
import {useLocale} from './Preferences';
import { useState } from 'react';
import { ArrowRight, Check, Copy, Plus, Users } from 'lucide-react';
import { GradeList } from './CarePanel';
import { AchievementView } from './Upgrade';
export function Invitations({ students, invites, role, refresh, notify }: any) { useLocale(); const [url, U] = useState(''), [busy, B] = useState(false); async function request(b: any) { B(true); try {
    const r = await fetch('/api/invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    const d: any = await r.json();
    if (!r.ok)
        throw Error(d.error);
    if (d.url)
        U(d.url);
    await refresh();
    notify('Taklif holati saqlandi');
}
catch (e: any) {
    notify(e.message);
}
finally {
    B(false);
} } return <section className="workflow-block"><h2>{localize("Hisoblarni taklif orqali bog\u2018lash")}</h2><p>{localize("Taklif 7 kun amal qiladi. Uni faqat ko\u2018rsatilgan elektron pochta egasi qabul qila oladi. Havola avtomatik yuborilmaydi.")}</p><form onSubmit={e => { e.preventDefault(); request({ action: 'create', ...Object.fromEntries(new FormData(e.currentTarget)) }); }}><label>{localize("O\u2018quvchi")}<select name="student" required><option value="">{localize("Tanlang")}</option>{students.map((s: any) => <option key={s.id} value={s.id}>{s.data.name}</option>)}</select></label><label>{localize("Hisob turi")}<select name="role">{localize(role !== 'parent' && <option value="parent">{localize("Ota-ona")}</option>)}<option value="student">{localize("O\u2018quvchi")}</option></select></label><label>{localize("Taklif oluvchining elektron pochtasi")}<input type="email" name="email" required placeholder={localize("example@email.com")}/></label><button className="primary" disabled={busy || !students.length}>{localize("Taklif havolasini yaratish")}</button></form>{localize(url && <div className="invite-result"><label>{localize("Ulashish uchun havola")}<input readOnly value={url} onFocus={e => e.target.select()}/></label><button className="secondary" onClick={async () => { try {
    await navigator.clipboard.writeText(url);
    notify('Havola nusxalandi');
}
catch {
    notify('Havolani belgilang va nusxalang');
} }}><Copy size={16}/>{localize(" Nusxalash")}</button></div>)}{invites.map((i: any) => <div className="row" key={i.id}><div><strong>{i.email}</strong><p>{localize(i.role === 'parent' ? 'Ota-ona' : 'O‘quvchi')}{localize(" \u00B7 ")}{localize(i.status === 'accepted' ? 'Qabul qilingan' : i.status === 'cancelled' ? 'Bekor qilingan' : new Date(i.expires) < new Date() ? 'Muddati tugagan' : 'Qabul qilish kutilmoqda')}</p></div>{localize(i.status === 'pending' && <button className="secondary" disabled={busy} onClick={() => request({ action: 'cancel', id: i.id })}>{localize("Bekor qilish")}</button>)}</div>)}</section>; }
export function GroupSession({ students, save }: any) { useLocale(); const [open, O] = useState(false), [busy, B] = useState(false); return <div className="workflow-block"><button className="secondary" onClick={() => O(!open)}><Users size={18}/>{localize(" Guruh mashg\u2018ulotini rejalashtirish")}</button>{open && <form onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const data = Object.fromEntries(fd); B(true); try {
    if (await save({ action: 'group_session', students: fd.getAll('students'), data }))
        O(false);
}
finally {
    B(false);
} }}><label>{localize("Mavzu")}<input name="title" required/></label><label>{localize("Guruh nomi")}<input name="group" required/></label><div className="grid two"><label>{localize("Sana")}<input type="date" name="date" required/></label><label>{localize("Vaqt")}<input type="time" name="time" required/></label></div><label>{localize("Izoh")}<textarea name="body"/></label><fieldset><legend>{localize("Qatnashadigan o\u2018quvchilar")}</legend>{students.map((s: any) => <label className="check" key={s.id}><input type="checkbox" name="students" value={s.id}/>{s.data.name}{localize(" \u00B7 ")}{localize(s.data.group)}</label>)}</fieldset><button className="primary" disabled={busy}>{localize("Jadvalga saqlash")}</button></form>}</div>; }
export function ChildCabinet({ records, save, go, me }: any) { useLocale(); const [tab, T] = useState('Mening topshiriqlarim'), [task, D] = useState<any>(null); const tasks = records.filter((r: any) => r.kind === 'task'); return <section className="child-space"><div className="child-welcome"><span>{localize("\u2726")}</span><div><h2>{localize("Bugun birga o\u2018rganamiz!")}</h2><p>{localize("Har bir urinish \u2014 yangi qadam.")}</p></div></div><div className="child-tabs">{localize(['Mening topshiriqlarim', 'O‘yinlar', 'Yutuqlarim', 'Baholarim', 'Chat'].map(t => <button className={t === tab ? 'primary' : 'secondary'} key={t} onClick={() => t === 'O‘yinlar' ? go('O‘yinlar') : T(t)}>{localize(t)}</button>))}</div>{tab === 'Chat' ? <ChatPanel me={me}/> : tab === 'Baholarim' ? <GradeList records={records} child/> : tab === 'Yutuqlarim' ? <AchievementView records={records}/> : tasks.length ? tasks.map((t: any) => <div className="row" key={t.id}><div><h3>{t.data.title}</h3><p>{t.data.body}</p><p>{localize(t.data.minutes)}{localize(" daqiqa \u00B7 ")}{localize(t.data.due)}</p><span className="badge">{localize(t.data.status === 'Logoped tekshiruvini kutmoqda' ? 'Bajarildi — tekshirish kutilmoqda' : t.data.status)}</span></div>{localize(!['Bajarildi', 'Logoped tekshirdi', 'Logoped tekshiruvini kutmoqda'].includes(t.data.status) && <button className="primary" onClick={() => D(t)}>{localize("Bajaramiz ")}<ArrowRight size={17}/></button>)}</div>) : <div className="empty">{localize("Hozircha topshiriq yo\u2018q. O\u2018yinlardan birini sinab ko\u2018ring!")}</div>}{task && tab === 'Mening topshiriqlarim' && <form className="workflow-block" onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); if (await save({ id: task.id, data: { status: 'Bajarildi', answer: fd.get('answer') } }))
    D(null); }}><h3>{task.data.title}</h3><label>{localize("Javobingiz yoki kichik izoh")}<textarea name="answer" placeholder={localize("Ota-onangiz yordamida yozishingiz mumkin")}/></label><p>{localize("Javobni logoped tekshiradi.")}</p><div className="actions"><button className="primary">{localize("Bajarildi ")}<Check size={18}/></button><button type="button" className="secondary" onClick={() => D(null)}>{localize("Yopish")}</button></div></form>}</section>; }
