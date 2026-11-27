import './globals.css';
import type {Metadata,Viewport} from 'next';
import Preferences from './components/Preferences';
const site=(()=>{try{return new URL((process.env.NEXT_PUBLIC_SITE_URL||'').trim().replace(/^["']|["']$/g,''))}catch{return undefined}})();
export const metadata:Metadata={metadataBase:site,title:{default:'LOGOPED.UZ — Birgalikda rivojlanamiz',template:'%s'},description:'Logoped, bola va ota-onani birlashtiruvchi ta’lim platformasi: mashqlar, o‘yinlar, videodarslar va kuzatuv.',applicationName:'LOGOPED.UZ',icons:{icon:[{url:'/favicon.svg',type:'image/svg+xml'},{url:'/icons/icon-192.png',sizes:'192x192',type:'image/png'}],apple:'/icons/apple-touch-icon.png'},openGraph:{type:'website',siteName:'LOGOPED.UZ',locale:'uz_UZ',title:'LOGOPED.UZ — Birgalikda rivojlanamiz',description:'Nutqni rivojlantiruvchi mashqlar, o‘yinlar va videodarslar.',images:[{url:'/logoped-u-session.png',alt:'Logoped va bola mashq qilmoqda'}]},appleWebApp:{capable:true,title:'LOGOPED.UZ',statusBarStyle:'default'}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:[{media:'(prefers-color-scheme: light)',color:'#34785c'},{media:'(prefers-color-scheme: dark)',color:'#101d17'}]};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="uz"><body><Preferences>{children}</Preferences></body></html>}
