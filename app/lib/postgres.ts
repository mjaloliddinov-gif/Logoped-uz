import {Pool} from 'pg';
import {rootCertificates} from 'node:tls';
// All SQL is application-owned. Parameters are always bound, never interpolated.
export function postgresSQL(input:string){
 let sql=input.replace(/^INSERT OR IGNORE INTO /i,'INSERT INTO '),i=0;
 const ignore=/^INSERT OR IGNORE INTO /i.test(input);
 sql=sql.replace(/'(?:''|[^'])*'|\?|\bwindow\b/g,token=>token==='?'?'$'+(++i):token==='window'?'"window"':token);
 if(ignore)sql+=' ON CONFLICT DO NOTHING';
 return sql;
}
export interface Queryable {query:(text:string,values?:any[])=>Promise<{rows:any[];rowCount?:number|null}>}
export class Statement{
 values:any[]=[];
 constructor(public text:string,private driver:Queryable){}
 bind(...values:any[]){this.values=values;return this}
 async first<T=any>():Promise<T|null>{return (await this.driver.query(postgresSQL(this.text),this.values)).rows[0]??null}
 async all<T=any>():Promise<{results:T[]}>{return {results:(await this.driver.query(postgresSQL(this.text),this.values)).rows}}
 async run(){const r=await this.driver.query(postgresSQL(this.text),this.values);return {meta:{changes:r.rowCount??r.rows.length}}}
}
/** Accepts a PEM pasted in any form: real or literal \\n line breaks, Windows line endings, surrounding quotes or spaces, several certificates. */
export function caCertificates(raw:unknown):string[]{
 const text=String(raw??'').replace(/\\r\\n|\\n|\\r/g,'\n').replace(/\r\n?/g,'\n');
 const out:string[]=[];
 for(const m of text.matchAll(/-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g)){
  const body=m[1].replace(/[^A-Za-z0-9+/=]/g,'');
  if(body)out.push('-----BEGIN CERTIFICATE-----\n'+body.match(/.{1,64}/g)!.join('\n')+'\n-----END CERTIFICATE-----\n');
 }
 return out;
}
let pool:Pool|undefined;
function connection(){
 if(pool)return pool;
 const value=process.env.DATABASE_URL;if(!value)throw Error('DATABASE_URL sozlanmagan');
 const url=new URL(value);url.searchParams.delete('sslmode');
 pool=new Pool({connectionString:url.toString(),max:3,idleTimeoutMillis:20000,connectionTimeoutMillis:10000,ssl:(()=>{const extra=caCertificates(process.env.DATABASE_CA_CERT);return {rejectUnauthorized:true,...(extra.length?{ca:[...rootCertificates,...extra]}:{})}})()});
 return pool;
}
const driver:Queryable={async query(text,values){const client=await connection().connect();try{await client.query('BEGIN');await client.query('SET LOCAL search_path=logoped,public');await client.query("SET LOCAL statement_timeout='15s'");const result=await client.query(text,values);await client.query('COMMIT');return result}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}};
export const database={prepare:(text:string)=>new Statement(text,driver),async batch(statements:Statement[]){const client=await connection().connect();try{await client.query('BEGIN');await client.query('SET LOCAL search_path=logoped,public');await client.query("SET LOCAL statement_timeout='15s'");const results=[];for(const s of statements){const r=await client.query(postgresSQL(s.text),s.values);results.push({meta:{changes:r.rowCount??0}})}await client.query('COMMIT');return results}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}};
