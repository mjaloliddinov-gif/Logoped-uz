'use client';
import {localize} from '../lib/i18n';
import {useLocale} from '../components/Preferences';
import { useEffect, useState } from 'react';
export default function Invitation() { useLocale(); const [token, T] = useState(''), [me, M] = useState<any>(null), [message, S] = useState(''), [busy, B] = useState(false), [loaded, L] = useState(false); useEffect(() => { let t = location.hash.slice(1); if (t) {
    sessionStorage.setItem('logoped_invite', t);
    history.replaceState(null, '', '/invite');
}
else
    t = sessionStorage.getItem('logoped_invite') || ''; T(t); fetch('/api/data').then(r => r.ok ? r.json() : null).then((d: any) => M(d?.me || null)).catch(() => S('Ulanishni tekshiring')).finally(() => L(true)); }, []); return <main className="admin-denied"><h1>{localize("Shaxsiy taklif")}</h1><p>{localize("Taklif yuborilgan elektron pochta bilan kirishingiz kerak. Bog\u2018lanish faqat tasdiqlaganingizdan keyin amalga oshadi.")}</p>{!loaded ? <p>{localize("Tekshirilmoqda\u2026")}</p> : !me ? <a className="primary" target="_top" href="/login">{localize("Hisobimga kirish")}</a> : <><p>{me.email}</p><button className="primary" disabled={busy || !token} onClick={async () => { B(true); try {
    const r = await fetch('/api/invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'accept', token }) });
    const d: any = await r.json();
    if (!r.ok)
        throw Error(d.error);
    sessionStorage.removeItem('logoped_invite');
    location.assign('/#Kabinet');
}
catch (e: any) {
    S(e.message);
}
finally {
    B(false);
} }}>{localize("Taklifni qabul qilish")}</button></>}<p role="status">{localize(message || (!token ? 'Taklif havolasi topilmadi. Yuborilgan to‘liq havolani oching.' : ''))}</p><a href="/">{localize("Bosh sahifaga qaytish")}</a></main>; }
