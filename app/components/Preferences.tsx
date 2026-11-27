'use client';
import {createContext,useContext,useEffect,useState} from 'react';
import {Globe,Sun,Moon} from 'lucide-react';
import {Language,localize,setActiveLanguage} from '../lib/i18n';
import InstallButton from './InstallButton';
const LocaleContext=createContext<Language>('uz');
export function useLocale(){return useContext(LocaleContext)}
export default function Preferences({children}:{children:React.ReactNode}){
 const [language,L]=useState<Language>('uz'),[dark,D]=useState(false),[ready,R]=useState(false);
 function applyLanguage(lang:Language){setActiveLanguage(lang);L(lang);document.documentElement.lang=lang;try{localStorage.setItem('logoped-language',lang)}catch{}}
 function applyTheme(next:boolean){D(next);document.documentElement.dataset.theme=next?'dark':'light';document.documentElement.style.colorScheme=next?'dark':'light';try{localStorage.setItem('logoped-theme',next?'dark':'light')}catch{}}
 useEffect(()=>{let lang:Language='uz',theme=window.matchMedia('(prefers-color-scheme: dark)').matches;try{const stored=localStorage.getItem('logoped-language');if(stored==='en'||stored==='ru')lang=stored;const saved=localStorage.getItem('logoped-theme');if(saved)theme=saved==='dark'}catch{}applyLanguage(lang);applyTheme(theme);R(true)},[]);
 return <LocaleContext.Provider value={language}><div className="preferences-bar" aria-label={localize('Sozlamalar')}><span className="preferences-brand">LOGOPED.UZ</span><div className="preferences-controls"><InstallButton/><Globe size={17} aria-hidden="true"/><label className="sr-only" htmlFor="interface-language">{localize('Interfeys tili')}</label><select id="interface-language" value={language} disabled={!ready} onChange={e=>applyLanguage(e.target.value as Language)} title={localize('Interfeys tili')}><option value="uz" lang="uz">O‘zbekcha</option><option value="ru" lang="ru">Русский</option><option value="en" lang="en">English</option></select><button type="button" disabled={!ready} className="theme-switch" aria-pressed={dark} aria-label={localize(dark?'Yorug‘ rejim':'Qorong‘i rejim')} onClick={()=>applyTheme(!dark)}>{dark?<Sun size={18}/>:<Moon size={18}/>}<span>{localize(dark?'Yorug‘ rejim':'Qorong‘i rejim')}</span></button></div></div>{language!=='uz'&&<div className="language-note">{localize('O‘quv materiallari va tovush mashqlari o‘zbek tilida.')}</div>}{children}</LocaleContext.Provider>
}
