export type Member={id:string;email:string;role:string;care?:boolean};
export function staff(m:Member){return m.role==='admin'||m.role==='logoped'}
export function careStaff(m:Member){return m.role==='logoped'||(m.role==='admin'&&m.care===true)}
export function canStudent(m:Member,s:any){return (careStaff(m)&&s.owner===m.id)||(m.role==='parent'&&s.data.parent===m.id)||(m.role==='student'&&s.data.account===m.id)}
export const publicKinds=['exercise','article','video','resource','sound','question'];
export function studentView(r:any){if(r.kind==='student')return {...r,data:{name:r.data.name,group:r.data.group}};if(r.kind==='task')return {...r,data:{title:r.data.title,body:r.data.body,due:r.data.due,minutes:r.data.minutes,exercise:r.data.exercise,status:r.data.status,answer:r.data.answer}};if(r.kind==='grade')return {...r,data:{title:r.data.title,score:r.data.score,scale:r.data.scale,date:r.data.date,criteria:r.data.criteria}};return r}
