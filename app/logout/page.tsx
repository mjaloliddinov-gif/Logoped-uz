'use client';
import {useEffect,useState} from 'react';
import {apiFetch} from '../lib/api-client';
import {useLocale} from '../components/Preferences';
import {localize as t} from '../lib/i18n';
export default function Logout(){useLocale();const [error,E]=useState('');async function leave(){E('');try{await apiFetch('/api/auth/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});window.location.replace('/login')}catch(e:any){E(e.message)}}useEffect(()=>{leave()},[]);return <main className="admin-denied"><h1>{t('Hisobdan chiqish')}</h1>{error?<><p role="alert">{t(error)}</p><button className="primary" onClick={leave}>{t('Qayta urinib ko‘rish')}</button></>:<p role="status">{t('Hisobdan chiqilmoqda…')}</p>}</main>}
