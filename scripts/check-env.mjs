const required=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SITE_URL','DATABASE_URL','SUPABASE_SECRET_KEY','ADMIN_EMAIL'];
let failed=false;for(const key of required){const value=process.env[key];const ok=value&&!/YOUR_|example\.com/.test(value);console.log(`${ok?'OK':'MISSING'} ${key}`);if(!ok)failed=true}
console.log('Values and secrets are never printed. Load .env.local with: node --env-file=.env.local scripts/check-env.mjs');process.exitCode=failed?1:0;
