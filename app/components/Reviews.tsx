'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {MessageSquare,Star,Trash2} from 'lucide-react';
import {localize,getLocaleTag} from '../lib/i18n';
import {useLocale} from './Preferences';
import {apiFetch} from '../lib/api-client';

const MAX=600;
export function Stars({value,size=16}:{value:number;size?:number}){
 useLocale();
 const full=Math.round(value*2)/2;
 return <span className="stars" role="img" aria-label={value.toFixed(1)+' / 5'}>{[1,2,3,4,5].map(n=><Star key={n} size={size} aria-hidden="true" className={n<=full?'on':n-.5<=full?'half':''} fill={n<=full?'currentColor':'none'}/>)}</span>
}
export function RatingBadge({stat}:{stat?:{count:number;average:number}}){
 useLocale();
 if(!stat||!stat.count)return null;
 return <span className="rating-badge" title={stat.average.toFixed(1)+' / 5'}><Star size={14} fill="currentColor" aria-hidden="true"/>{stat.average.toFixed(1)}<small>({stat.count})</small></span>
}
function RatingInput({value,onChange,disabled}:{value:number;onChange:(n:number)=>void;disabled?:boolean}){
 const refs=useRef<(HTMLButtonElement|null)[]>([]);
 function key(e:React.KeyboardEvent,n:number){
  let next=n;
  if(e.key==='ArrowRight'||e.key==='ArrowUp')next=Math.min(5,n+1);else if(e.key==='ArrowLeft'||e.key==='ArrowDown')next=Math.max(1,n-1);else return;
  e.preventDefault();onChange(next);refs.current[next-1]?.focus();
 }
 return <div className="star-input" role="radiogroup" aria-label={localize('Baho')}>{[1,2,3,4,5].map(n=><button key={n} type="button" ref={el=>{refs.current[n-1]=el}} role="radio" aria-checked={value===n} aria-label={n+' / 5'} tabIndex={value===n||(!value&&n===1)?0:-1} disabled={disabled} className={n<=value?'on':''} onClick={()=>onChange(n)} onKeyDown={e=>key(e,n)}><Star size={30} fill={n<=value?'currentColor':'none'} aria-hidden="true"/></button>)}</div>
}
export default function Reviews({target,onChange}:{target:string;onChange?:()=>void}){
 useLocale();
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[rating,setRating]=useState(0),[text,setText]=useState('');
 const loaded=useRef(false);
 const load=useCallback(async()=>{
  try{
   const d=await apiFetch('/api/reviews?target='+encodeURIComponent(target));
   setData(d);setError('');
   if(!loaded.current){loaded.current=true;if(d.mine){setRating(d.mine.rating);setText(d.mine.text||'')}}
  }catch(e:any){setError(e.message)}
 },[target]);
 useEffect(()=>{loaded.current=false;setData(null);setRating(0);setText('');setNote('');load()},[load]);
 async function submit(e:React.FormEvent){
  e.preventDefault();setNote('');
  if(!rating){setError(localize('1 dan 5 gacha baho tanlang.'));return}
  setBusy(true);setError('');
  try{await apiFetch('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',target,rating,text})});await load();setNote(localize('Rahmat! Sharhingiz saqlandi.'));onChange?.()}
  catch(e:any){setError(e.message)}
  finally{setBusy(false)}
 }
 async function remove(){
  if(!data?.mine?.id)return;
  setBusy(true);setError('');setNote('');
  try{await apiFetch('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',id:data.mine.id})});loaded.current=true;setRating(0);setText('');await load();onChange?.()}
  catch(e:any){setError(e.message)}
  finally{setBusy(false)}
 }
 const summary=data?.summary,max=Math.max(1,...(summary?.distribution||[1]));
 return <section className="reviews no-print" aria-labelledby={'reviews-'+target}>
  <h3 id={'reviews-'+target}><MessageSquare size={20} aria-hidden="true"/>{localize('Baho va sharhlar')}</h3>
  {summary&&<div className="reviews-summary">
   <div className="reviews-score"><strong>{summary.count?summary.average.toFixed(1):'—'}</strong><Stars value={summary.average} size={17}/><small>{summary.count?summary.count+' '+localize('ta baho'):localize('Hali baho yo‘q')}</small></div>
   <div className="reviews-bars" aria-hidden="true">{[5,4,3,2,1].map(n=><div key={n}><span>{n}</span><i><b style={{width:(summary.distribution[n-1]/max*100)+'%'}}/></i><em>{summary.distribution[n-1]}</em></div>)}</div>
  </div>}
  {!data&&!error&&<p className="reviews-hint" role="status">{localize('Yuklanmoqda…')}</p>}
  {data&&(data.canWrite?<form className="review-form" onSubmit={submit}>
   <p className="review-label">{localize(data.mine?'Sizning bahoyingiz':'Bahoingizni qoldiring')}</p>
   <RatingInput value={rating} onChange={setRating} disabled={busy}/>
   <label>{localize('Izoh (ixtiyoriy)')}<textarea value={text} maxLength={MAX} rows={3} disabled={busy} onChange={e=>setText(e.target.value)} placeholder={localize('Mashq bolangizga qanday ta’sir qildi?')}/></label>
   <div className="review-actions"><small>{text.length}/{MAX}</small><span className="grow"/>{data.mine&&<button type="button" className="secondary" disabled={busy} onClick={remove}><Trash2 size={16}/>{localize(' O‘chirish')}</button>}<button className={'primary'+(busy?' is-busy':'')} disabled={busy||!rating}>{localize(data.mine?'Yangilash':'Yuborish')}</button></div>
   {data.mine?.hidden&&<p className="notice">{localize('Sharhingiz administrator tomonidan vaqtincha yashirilgan.')}</p>}
  </form>:<p className="notice">{data.role?localize('Sharh qoldirish uchun tasdiqlangan ota-ona, logoped yoki administrator hisobi kerak.'):<>{localize('Baho qoldirish uchun ')}<a href="/login">{localize('hisobingizga kiring')}</a>{localize('.')}</>}</p>)}
  {note&&<p className="review-ok" role="status">{note}</p>}
  {error&&<p className="auth-error" role="alert">{error}</p>}
  {data&&(data.reviews.length?<ul className="review-list">{data.reviews.map((r:any)=><li key={r.id} className={r.mine?'mine':''}><div><strong>{r.name}</strong>{r.mine&&<span className="badge">{localize('Siz')}</span>}<Stars value={r.rating} size={14}/><time dateTime={r.created}>{new Date(r.created).toLocaleDateString(getLocaleTag())}</time></div>{r.text&&<p>{r.text}</p>}</li>)}</ul>:<p className="reviews-hint">{localize('Birinchi sharhni siz qoldiring.')}</p>)}
 </section>
}
