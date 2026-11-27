import {Pool} from 'pg';
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
let pool:Pool|undefined;
function connection(){
 if(pool)return pool;
 const value=process.env.DATABASE_URL;if(!value)throw Error('DATABASE_URL sozlanmagan');
 const url=new URL(value);url.searchParams.delete('sslmode');
 pool=new Pool({connectionString:url.toString(),max:3,idleTimeoutMillis:20000,connectionTimeoutMillis:10000,ssl:{rejectUnauthorized:true,...(process.env.DATABASE_CA_CERT?{ca:process.env.DATABASE_CA_CERT.replace(/\\n/g,'\n')}: {})}});
 return pool;
}
const driver:Queryable={async query(text,values){const client=await connection().connect();try{await client.query('BEGIN');await client.query('SET LOCAL search_path=logoped,public');await client.query("SET LOCAL statement_timeout='15s'");const result=await client.query(text,values);await client.query('COMMIT');return result}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}};
export const database={prepare:(text:string)=>new Statement(text,driver),async batch(statements:Statement[]){const client=await connection().connect();try{await client.query('BEGIN');await client.query('SET LOCAL search_path=logoped,public');await client.query("SET LOCAL statement_timeout='15s'");const results=[];for(const s of statements){const r=await client.query(postgresSQL(s.text),s.values);results.push({meta:{changes:r.rowCount??0}})}await client.query('COMMIT');return results}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}};
