import {canStudent,careStaff} from './permissions';
// Accepting an invite links an account to a child's profile. Shared by the site and the Telegram bot.
type Db={prepare:(sql:string)=>any;batch:(s:any[])=>Promise<any[]>};
export const inviteHash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
export const validInviteToken=(t:unknown):t is string=>typeof t==='string'&&/^[0-9a-f]{48}$/.test(t);
export async function findInvite(db:Db,token:string){return db.prepare('SELECT * FROM invites WHERE token_hash=?').bind(await inviteHash(token)).first()}
async function pupil(db:Db,id:string){const r=await db.prepare("SELECT * FROM records WHERE id=? AND kind='student'").bind(id).first();return r?{...r,data:JSON.parse(r.data)}:null}
export type AcceptResult={ok:true;role:string;student:string;studentName:string}|{ok:false;status:number;error:string};
export async function acceptInvite(db:Db,m:{id:string;email:string;role:string},token:string):Promise<AcceptResult>{
 const now=new Date().toISOString(),fail=(status:number,error:string)=>({ok:false as const,status,error});
 if(!validInviteToken(token))return fail(400,'Taklif kodi noto‘g‘ri');
 const invite=await findInvite(db,token);
 if(!invite||invite.status!=='pending'||invite.expires<now||(invite.email&&invite.email!==String(m.email).toLowerCase()))return fail(403,'Taklif yaroqsiz, muddati tugagan yoki boshqa hisobga tegishli');
 if(!['pending',invite.role].includes(m.role))return fail(403,'Bu hisobning amaldagi roli taklifga mos emas');
 const p=await pupil(db,invite.student);
 const actor=await db.prepare('SELECT * FROM members WHERE id=?').bind(invite.owner).first();
 const care=await db.prepare('SELECT value FROM settings WHERE id=?').bind('care:'+invite.owner).first();
 const originator=actor?{...actor,care:care?.value==='true'}:null;
 if(!p||!originator||!canStudent(originator,p)||!(careStaff(originator)||(originator.role==='parent'&&invite.role==='student')))return fail(403,'Taklif beruvchining vakolati bekor qilingan');
 const field=invite.role==='parent'?'parent':'account';
 if(p.data[field])return fail(409,'Profilga hisob allaqachon biriktirilgan');
 const exists=await db.prepare("SELECT id FROM records WHERE kind='student' AND json_extract(data,'$.account')=?").bind(m.id).first();
 if(invite.role==='student'&&exists)return fail(409,'O‘quvchi hisobi boshqa profilga biriktirilgan');
 await db.batch([
  db.prepare("UPDATE invites SET status='accepted',accepted_by=? WHERE id=? AND status='pending' AND expires>=? AND NOT EXISTS(SELECT 1 FROM records WHERE id=? AND COALESCE(json_extract(data,?), '')<>'')").bind(m.id,invite.id,now,p.id,'$.'+field),
  db.prepare('INSERT INTO members SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM invites WHERE id=? AND accepted_by=?) ON CONFLICT(id) DO UPDATE SET role=excluded.role').bind(m.id,m.email,invite.role,invite.id,m.id),
  db.prepare("UPDATE records SET data=json_set(data,?,?) WHERE id=? AND EXISTS(SELECT 1 FROM invites WHERE id=? AND accepted_by=?)").bind('$.'+field,m.id,p.id,invite.id,m.id),
  db.prepare('INSERT INTO audit VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),m.id,'invite_accepted',invite.id,now),
 ]);
 return {ok:true,role:invite.role,student:p.id,studentName:String(p.data.name||'')};
}
