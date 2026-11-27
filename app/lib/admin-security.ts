import {env} from './runtime';
import {headers} from 'next/headers';
const db=()=>env.DB!;
export const ADMIN_COOKIE='__Host-logoped-admin';
export const GRANT_SECONDS=1800;
export class AdminLocked extends Error {constructor(){super('Admin kodini kiriting');this.name='AdminLocked'}}
export const randomSecret=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('')}
export async function codeHash(code:string,salt:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(code),'PBKDF2',false,['deriveBits']);return Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:600000},key,256)),n=>n.toString(16).padStart(2,'0')).join('')}
export function equalHash(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
export function validCode(code:unknown):code is string{return typeof code==='string'&&code.length>=12&&code.length<=64&&!/\s/.test(code)&&!/^([\s\S])\1+$/.test(code)}
export async function adminConfig(owner:string){const row=await db().prepare('SELECT value FROM settings WHERE id=?').bind('admin-code:'+owner).first<{value:string}>();return row?JSON.parse(row.value):null}
export async function currentToken(){const h=await headers();const value=(h.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(ADMIN_COOKIE+'='))?.slice(ADMIN_COOKIE.length+1)||'';return /^[a-f0-9]{64}$/.test(value)?value:''}
export async function adminUnlocked(owner:string){const code=await adminConfig(owner),token=await currentToken();if(!code||!token)return false;return !!await db().prepare('SELECT token_hash FROM admin_grants WHERE token_hash=? AND owner=? AND version=? AND expires>?').bind(await digest(token),owner,code.version,Date.now()).first()}
export async function attemptAllowed(owner:string){const now=Date.now();return !!await db().prepare(`INSERT INTO admin_attempts VALUES (?,?,1) ON CONFLICT(owner) DO UPDATE SET window=CASE WHEN admin_attempts.window<=? THEN excluded.window ELSE admin_attempts.window END, attempts=CASE WHEN admin_attempts.window<=? THEN 1 ELSE admin_attempts.attempts+1 END WHERE admin_attempts.window<=? OR admin_attempts.attempts<5 RETURNING owner`).bind(owner,now,now-900000,now-900000,now-900000).first()}
export function cookie(value:string,seconds=GRANT_SECONDS){return `${ADMIN_COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${seconds}`}
