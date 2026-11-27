import type {MetadataRoute} from 'next';
export default function manifest():MetadataRoute.Manifest{
 return {name:'LOGOPED.UZ — Birgalikda rivojlanamiz',short_name:'LOGOPED.UZ',description:'Logoped, bola va ota-onani birlashtiruvchi ta’lim platformasi',start_url:'/',scope:'/',display:'standalone',orientation:'portrait',background_color:'#fafbf7',theme_color:'#34785c',lang:'uz',
  icons:[{src:'/icons/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/icons/icon-512.png',sizes:'512x512',type:'image/png'},{src:'/icons/icon-maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]};
}
