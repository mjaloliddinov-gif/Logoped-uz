const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const env={},logged=[];const mod={exports:{}};
const src=ts.transpileModule(fs.readFileSync('app/lib/server.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext('(function(require,module,exports){'+src+'})',{process:{env},Request,Response,URL,console:{error:(...a)=>logged.push(a.join(' '))},crypto:globalThis.crypto})(()=>({env:{},adminUnlocked(){},AdminLocked:class{},getAppUser(){}}),mod,mod.exports);
const {sameOrigin}=mod.exports;let count=0;
const req=(headers,url='https://school.example/api/data')=>new Request(url,{method:'POST',headers});
const ok=(h,u)=>{assert.equal(sameOrigin(req(h,u)),true,JSON.stringify(h));count++},no=(h,u)=>{assert.equal(sameOrigin(req(h,u)),false,JSON.stringify(h));count++};
// normal same-origin request
ok({origin:'https://school.example'});
// attackers: other sites, null-ish values, lookalikes, wrong scheme
no({origin:'https://evil.example'});no({origin:'https://school.example.evil.example'});no({origin:'http://school.example'});no({origin:'not a url'});no({origin:'ftp://school.example'});
// missing Origin: only a browser-asserted same-origin fetch is accepted
no({});no({'sec-fetch-site':'cross-site'});no({'sec-fetch-site':'same-site'});ok({'sec-fetch-site':'same-origin'});ok({origin:'null','sec-fetch-site':'same-origin'});no({origin:'null'});
// Vercel: req.url shows an internal host but the browser used the real domain (Host / x-forwarded-host)
const internal='https://logoped-abc123.vercel.app/api/data';
no({origin:'https://school.example'},internal);
ok({origin:'https://school.example',host:'school.example'},internal);
ok({origin:'https://school.example','x-forwarded-host':'school.example, proxy.internal'},internal);
no({origin:'https://evil.example',host:'school.example'},internal);
// configured site address and Vercel system hosts
env.NEXT_PUBLIC_SITE_URL='  "https://www.school.example/"  ';ok({origin:'https://www.school.example'},internal);no({origin:'https://other.example'},internal);
env.VERCEL_PROJECT_PRODUCTION_URL='logoped-uz.vercel.app';ok({origin:'https://logoped-uz.vercel.app'},internal);
env.VERCEL_BRANCH_URL='logoped-git-main.vercel.app';ok({origin:'https://logoped-git-main.vercel.app'},internal);
// local development over http
ok({origin:'http://localhost:3000'},'http://localhost:3000/api/data');no({origin:'http://192.168.1.5:3000'},'http://192.168.1.5:3000/api/data');
// rejections are logged with host names only (no cookies/headers), to make Vercel logs useful
assert.ok(logged.length>3&&logged.every(l=>l.startsWith('[origin] rejected')));count++;
console.log(count+' request-origin (CSRF) checks passed');
