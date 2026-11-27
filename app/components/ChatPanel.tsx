'use client';
import {localize,getLocaleTag} from '../lib/i18n';
import {useLocale} from './Preferences';
import { apiFetch } from '../lib/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, RefreshCw, Search, CheckCheck } from 'lucide-react';
type Contact = {
    id: string;
    name: string;
    email?: string;
    unread: number;
    role: string;
};
type Message = {
    id: string;
    sender: string;
    recipient: string;
    text: string;
    seen: string;
    created: string;
};
export function ChatPanel({ me, initialPeer = '' }: any) {
    useLocale();
    const [contacts, C] = useState<Contact[]>([]), [peer, P] = useState(initialPeer), [messages, M] = useState<Message[]>([]), [draft, D] = useState(''), [search, Q] = useState(''), [busy, B] = useState(false), [loading, L] = useState(true), [error, E] = useState(''), [errorCode, EC] = useState(''), [more, H] = useState(false), [older, O] = useState(false);
    const active = useRef(''), listRef = useRef<HTMLDivElement>(null);
    const admin = me.role === 'admin';
    const load = useCallback(async (target: string, before?: Message) => { const query = new URLSearchParams(); if (target)
        query.set('peer', target); if (before)
        query.set('before', JSON.stringify([before.created, before.id])); const d = await apiFetch('/api/chat?' + query); if (active.current !== target)
        return; C(d.contacts); if (!target) {
        if (d.contacts.length) {
            active.current = d.contacts[0].id;
            P(d.contacts[0].id);
        }
        return;
    } M(prev => { const all = new Map<string, Message>(); for (const m of [...prev, ...d.messages])
        all.set(m.id, m); return [...all.values()].sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id)); }); if (before || !listRef.current?.dataset.loaded)
        H(d.hasMore); if (listRef.current)
        listRef.current.dataset.loaded = 'yes'; const unread = d.messages.filter((m: Message) => m.sender !== me.id && m.seen === '0').map((m: Message) => m.id); if (unread.length && document.visibilityState === 'visible') {
        const read = await apiFetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'read', peer: target, ids: unread }) });
        if (read.ok)
            C(prev => prev.map(c => c.id === target ? { ...c, unread: Math.max(0, c.unread - unread.length) } : c));
    } }, [me.id]);
    useEffect(() => { active.current = peer; L(true); E(''); EC(''); if (listRef.current)
        delete listRef.current.dataset.loaded; let alive = true; async function update() { try {
        await load(peer);
        if (alive)
            E('');
    }
    catch (e: any) {
        if (alive) {
            E(e.message);
            EC(e.code || 'request_failed');
        }
    }
    finally {
        if (alive)
            L(false);
    } } update(); const timer = setInterval(() => { if (document.visibilityState === 'visible')
        update(); }, 15000); return () => { alive = false; clearInterval(timer); }; }, [peer, load]);
    function select(id: string) { active.current = id; M([]); D(''); H(false); P(id); }
    async function send(e: React.FormEvent) { e.preventDefault(); if (!draft.trim() || busy)
        return; B(true); E(''); const target = peer; try {
        await apiFetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', peer: target, text: draft }) });
        if (active.current === target) {
            D('');
            try {
                await load(target);
            }
            catch {
                E('Xabar yuborildi, lekin yozishmalar yangilanmadi. “Qayta urinish”ni bosing.');
                EC('refresh_failed');
            }
            requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }));
        }
    }
    catch (e: any) {
        E(e.message);
        EC(e.code || 'request_failed');
    }
    finally {
        B(false);
    } }
    const selected = contacts.find(c => c.id === peer);
    return <section className="chat-panel" aria-label={localize("Shaxsiy yozishmalar")}><aside className="chat-contacts"><div className="chat-caption"><MessageCircle size={22}/><h2>{localize(admin ? 'O‘quvchilar va ota-onalar bilan chat' : 'Administrator bilan chat')}</h2></div><label className="search"><Search size={17}/><input value={search} onChange={e => Q(e.target.value)} placeholder={localize("Suhbatni qidirish")} aria-label={localize("Suhbatni qidirish")}/></label><nav aria-label={localize("Suhbatlar")}>{contacts.filter(c => (c.name + ' ' + (c.email || '')).toLowerCase().includes(search.toLowerCase())).map(c => <button disabled={busy} key={c.id} className={peer === c.id ? 'selected' : ''} onClick={() => select(c.id)} aria-pressed={peer === c.id}><span className="chat-avatar">{c.name.slice(0, 1).toUpperCase()}</span><span><strong>{c.name}</strong><small>{localize(admin ? (c.role === 'student' ? 'O‘quvchi' : 'Ota-ona') : 'Administrator')}</small></span>{localize(c.unread > 0 && <b aria-label={localize(c.unread + ' ta o‘qilmagan xabar')}>{localize(c.unread)}</b>)}</button>)}</nav>{localize(!contacts.length && !loading && <p className="chat-hint">{localize(admin ? 'Tasdiqlangan o‘quvchi yoki ota-ona hisobi paydo bo‘lgach suhbatni boshlashingiz mumkin.' : 'Hozircha administrator topilmadi.')}</p>)}<p className="chat-hint">{localize("Shaxsiy suhbat. Xabarlar serverda saqlanadi. Har 15 soniyada yangilanadi.")}</p></aside><div className="chat-conversation"><header><div><strong>{selected?.name || 'Suhbatni tanlang'}</strong><small>{localize(peer ? 'Faqat siz va suhbatdoshingiz ko‘radi' : 'Savolingizni shu yerda yozishingiz mumkin')}</small></div><button className="secondary" aria-label={localize("Chatni yangilash")} disabled={busy} onClick={() => load(peer).then(() => E('')).catch(e => { E(e.message); EC(e.code || 'request_failed'); })}><RefreshCw size={17}/></button></header>{localize(error && <div className="auth-error chat-recovery" role="alert"><p>{localize(error)}</p>{localize(['auth_required', 'unexpected_response'].includes(errorCode) && <a className="primary" target="_top" href={'/login' + encodeURIComponent(admin ? '/admin' : '/#Kabinet')}>{localize("Hisobga qayta kirish")}</a>)}<button type="button" className="secondary" onClick={() => load(peer).then(() => E('')).catch(e => { E(e.message); EC(e.code || 'request_failed'); })}>{localize("Qayta urinish")}</button></div>)}<div className="chat-messages" ref={listRef} role="log" aria-label={localize("Xabarlar")} aria-live="polite" aria-relevant="additions">{localize(more && <button className="secondary older-messages" disabled={older} onClick={async () => { O(true); try {
        await load(peer, messages[0]);
    }
    catch (e: any) {
        E(e.message);
        EC(e.code || 'request_failed');
    }
    finally {
        O(false);
    } }}>{localize(older ? 'Yuklanmoqda…' : 'Oldingi xabarlar')}</button>)}{loading && !messages.length ? <p className="chat-empty">{localize("Yozishmalar yuklanmoqda\u2026")}</p> : !messages.length ? <div className="chat-empty"><MessageCircle size={36}/><h3>{localize("Suhbatni boshlang")}</h3><p>{localize("Uy vazifasi yoki mashg\u2018ulot haqida savolingiz bormi?")}</p></div> : messages.map(m => <article key={m.id} className={'chat-bubble ' + (m.sender === me.id ? 'outgoing' : 'incoming')}><p>{m.text}</p><footer><time dateTime={m.created}>{localize(new Date(m.created).toLocaleString(getLocaleTag(), { timeZone: 'Asia/Tashkent', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</time>{localize(m.sender === me.id && <span>{localize(m.seen === '1' ? <><CheckCheck size={14}/>{localize(" O\u2018qildi")}</> : 'Yuborildi')}</span>)}</footer></article>)}</div><form className="chat-compose" onSubmit={send}><label htmlFor="chat-draft" className="chat-input-label">{localize("Xabaringiz")}</label><textarea id="chat-draft" maxLength={3000} rows={3} value={draft} disabled={!peer || busy} placeholder={localize("Savol yoki xabaringizni yozing\u2026")} onChange={e => D(e.target.value)}/><div><small>{localize(draft.length)}{localize("/3000")}</small><button className="primary" disabled={!peer || busy || !draft.trim()} type="submit"><Send size={17}/>{localize(busy ? 'Yuborilmoqda…' : 'Yuborish')}</button></div></form></div></section>;
}
