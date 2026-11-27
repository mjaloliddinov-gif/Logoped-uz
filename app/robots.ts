import type {MetadataRoute} from 'next';
const base=(process.env.NEXT_PUBLIC_SITE_URL||'').trim().replace(/^["']|["']$/g,'').replace(/\/$/,'');
export default function robots():MetadataRoute.Robots{return {rules:[{userAgent:'*',allow:'/',disallow:['/api/','/admin','/content','/auth/','/invite','/logout','/reset-password']}],...(base?{sitemap:base+'/sitemap.xml'}:{})}}
