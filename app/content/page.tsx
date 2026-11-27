import {AdminLocked} from '../lib/admin-security';
import {identity} from '../lib/server';
import {redirect} from 'next/navigation';
import AdminPanel from '../components/AdminPanel';
export const dynamic='force-dynamic';
export default async function Content(){let m;try{m=(await identity()).member}catch(e){if(e instanceof AdminLocked)redirect('/admin');redirect('/login')}if(!['admin','logoped'].includes(m.role))return <main className="admin-denied"><h1>Kirish cheklangan</h1><a href="/">Bosh sahifa</a></main>;return <AdminPanel contentOnly/>}
