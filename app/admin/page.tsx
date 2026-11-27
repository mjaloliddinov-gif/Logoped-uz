import {identity,database} from '../lib/server';
import {adminConfig,adminUnlocked} from '../lib/admin-security';
import {redirect} from 'next/navigation';
import AdminPanel from '../components/AdminPanel';
import AdminGate from '../components/AdminGate';
export const dynamic='force-dynamic';
export const metadata={title:'Administrator paneli — LOGOPED.UZ'};
export default async function Admin(){
 let account;try{account=await identity({allowLockedAdmin:true})}catch{redirect('/login')}
 const initialized=await database().prepare("SELECT value FROM settings WHERE id='initialized'").first();
 if(!initialized)return <AdminPanel/>;
 if(account.member.role!=='admin')return <main className="admin-denied"><h1>Kirish cheklangan</h1><p>Ushbu bo‘lim faqat administrator uchun.</p><a className="primary" href="/login">Hisobga kirish</a><a className="secondary" href="/">Bosh sahifa</a></main>;
 if(!await adminUnlocked(account.member.id))return <main className="admin-gate-page"><AdminGate configured={!!await adminConfig(account.member.id)}/></main>;
 return <AdminPanel/>;
}
