import type {MetadataRoute} from 'next';
const base=(process.env.NEXT_PUBLIC_SITE_URL||'').trim().replace(/^["']|["']$/g,'').replace(/\/$/,'');
export default function sitemap():MetadataRoute.Sitemap{if(!base)return [];return ['/','/login','/signup'].map(p=>({url:base+p,changeFrequency:'weekly' as const,priority:p==='/'?1:.5}))}
