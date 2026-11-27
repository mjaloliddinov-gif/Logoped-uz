import 'server-only';
import {database} from './postgres';
import {createClient} from '@supabase/supabase-js';
function storage(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;if(!url||!key)throw Error('Supabase Storage sozlanmagan');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}).storage.from(process.env.SUPABASE_STORAGE_BUCKET||'logoped-private')}
export const env={DB:database,BUCKET:{
 async put(key:string,bytes:Uint8Array,options?:{httpMetadata?:{contentType?:string}}){const {error}=await storage().upload(key,bytes,{contentType:options?.httpMetadata?.contentType,upsert:false});if(error)throw Error('Fayl saqlanmadi')},
 async get(key:string){const {data,error}=await storage().download(key);if(error||!data)return null;return {body:data.stream()}},
 async delete(key:string){const {error}=await storage().remove([key]);if(error)throw Error('Fayl o‘chirilmadi')},
},get OPENAI_API_KEY(){return process.env.OPENAI_API_KEY},get OPENAI_MODEL(){return process.env.OPENAI_MODEL}};
