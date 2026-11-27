'use client';
import {useEffect,useRef,useState} from 'react';
import {Check,Download} from 'lucide-react';
import {localize} from '../lib/i18n';
import {buildOfflineHtml,offlineFileName} from '../lib/offline-copy';
import {useLocale} from './Preferences';
interface InstallPrompt extends Event{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>}
type Phase='idle'|'busy'|'done'|'installed'|'error';
/** One button. If the browser can install the site as an app it does that; otherwise it downloads an offline copy. */
export default function InstallButton(){
 useLocale();
 const [phase,setPhase]=useState<Phase>('idle'),[standalone,setStandalone]=useState(false),prompt=useRef<InstallPrompt|null>(null);
 useEffect(()=>{
  setStandalone(matchMedia('(display-mode: standalone)').matches||(navigator as any).standalone===true);
  const before=(e:Event)=>{e.preventDefault();prompt.current=e as InstallPrompt};
  const installed=()=>{prompt.current=null;setPhase('installed')};
  addEventListener('beforeinstallprompt',before);addEventListener('appinstalled',installed);
  if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{});
  return()=>{removeEventListener('beforeinstallprompt',before);removeEventListener('appinstalled',installed)};
 },[]);
 useEffect(()=>{if(phase!=='done'&&phase!=='error')return;const t=setTimeout(()=>setPhase('idle'),3500);return()=>clearTimeout(t)},[phase]);
 if(standalone)return null;
 async function click(){
  if(phase==='busy')return;
  const install=prompt.current;
  if(install){prompt.current=null;try{await install.prompt();if((await install.userChoice).outcome==='accepted'){setPhase('installed');return}}catch{}}
  setPhase('busy');
  try{
   const html=await buildOfflineHtml({origin:location.origin,theme:document.documentElement.dataset.theme});
   const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'})),a=document.createElement('a');
   a.href=url;a.download=offlineFileName();document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
   setPhase('done');
  }catch{setPhase('error')}
 }
 const label=phase==='busy'?'Tayyorlanmoqda…':phase==='done'?'Yuklandi':phase==='installed'?'Ilova o‘rnatildi':'Yuklab olish';
 return <><button type="button" className={'download-button'+(phase==='busy'?' is-busy':'')+(phase==='done'||phase==='installed'?' is-done':'')} onClick={click} disabled={phase==='busy'||phase==='installed'} title={localize('Saytni yuklab olish')} aria-label={localize('Saytni yuklab olish')}>{phase==='done'||phase==='installed'?<Check size={17} aria-hidden="true"/>:<Download size={17} aria-hidden="true"/>}<span>{localize(label)}</span></button><span className="sr-only" role="status">{phase==='error'?localize('Yuklab bo‘lmadi. Qayta urinib ko‘ring.'):''}</span>{phase==='error'&&<span className="download-error" aria-hidden="true">{localize('Yuklab bo‘lmadi. Qayta urinib ko‘ring.')}</span>}</>
}
