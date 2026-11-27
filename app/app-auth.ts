import {authClient} from './lib/supabase/server';
export async function getAppUser(){const client=await authClient();const {data:{user},error}=await client.auth.getUser();if(error||!user||!user.email||!user.email_confirmed_at)return null;return {userId:user.id,email:user.email,displayName:typeof user.user_metadata?.name==='string'?user.user_metadata.name:user.email,fullName:null}}
