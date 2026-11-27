'use client';
import {useCallback,useEffect,useState} from 'react';
import {Eye,EyeOff,Trash2} from 'lucide-react';
import {localize,getLocaleTag} from '../lib/i18n';
import {apiFetch} from '../lib/api-client';
import {useLocale} from './Preferences';
import {Stars} from './Reviews';
/** Admin-only list of every rating and comment, newest first, with hide/show and delete. */
export default function ReviewModeration(){
 useLocale();
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[filter,setFilter]=useState<'all'|'comments'|'hidden'>('all');
 const load=useCallback(async()=>{try{setData(await apiFetch('/api/reviews?moderate=1'));setError('')}catch(e:any){if(e.code==='admin_locked'){location.replace('/admin');return}setError(e.message)}},[]);
 useEffect(()=>{load()},[load]);
 async function act(body:any){
  setBusy(body.id);setError('');
  try{await apiFetch('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});await load()}
  catch(e:any){setError(e.message)}
  finally{setBusy('')}
 }
 const list=(data?.reviews||[]).filter((r:any)=>filter==='hidden'?r.hidden:filter==='comments'?!!r.text:true);
 return <>
  {data&&<div className="admin-stats" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}>
   <div className="admin-stat as0"><strong>{data.summary.count}</strong><span>{localize('Jami baholar')}</span></div>
   <div className="admin-stat as1"><strong>{data.summary.count?data.summary.average.toFixed(1):'—'}</strong><span>{localize('O‘rtacha baho')}</span></div>
   <div className="admin-stat as2"><strong>{data.reviews.filter((r:any)=>r.hidden).length}</strong><span>{localize('Yashirilgan')}</span></div>
  </div>}
  <div className="admin-toolbar">
   <select aria-label={localize('Filtr')} value={filter} onChange={e=>setFilter(e.target.value as any)}><option value="all">{localize('Barcha sharhlar')}</option><option value="comments">{localize('Faqat izohli')}</option><option value="hidden">{localize('Yashirilganlar')}</option></select>
  </div>
  {error&&<p className="auth-error" role="alert">{error}</p>}
  {!data&&!error&&<p role="status">{localize('Yuklanmoqda…')}</p>}
  {data&&(list.length?<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{localize('Material')}</th><th>{localize('Baho')}</th><th>{localize('Izoh')}</th><th>{localize('Sana')}</th><th>{localize('Amal')}</th></tr></thead><tbody>{list.map((r:any)=><tr key={r.id} className={r.hidden?'is-hidden':''}>
   <td><strong>{r.targetName}</strong><small>{r.name}</small></td>
   <td><Stars value={r.rating} size={15}/></td>
   <td className="review-admin-text">{r.text||'—'}{r.hidden&&<> <span className="badge">{localize('Yashirilgan')}</span></>}</td>
   <td>{new Date(r.created).toLocaleDateString(getLocaleTag())}</td>
   <td><div className="admin-actions"><button className="secondary" disabled={busy===r.id} onClick={()=>act({action:'hide',id:r.id,hidden:!r.hidden})}>{r.hidden?<Eye size={16}/>:<EyeOff size={16}/>}{localize(r.hidden?' Ko‘rsatish':' Yashirish')}</button><button className="secondary" disabled={busy===r.id} onClick={()=>{if(confirm(localize('Bu sharh butunlay o‘chiriladi. Davom etamizmi?')))act({action:'delete',id:r.id})}}><Trash2 size={16}/>{localize(' O‘chirish')}</button></div></td>
  </tr>)}</tbody></table></div>:<div className="empty"><p>{localize('Hozircha sharhlar yo‘q.')}</p></div>)}
 </>
}
