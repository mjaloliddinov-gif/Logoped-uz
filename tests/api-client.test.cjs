const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const moduleObject={exports:{}};let lastOptions;let response;
const source=ts.transpileModule(fs.readFileSync('app/lib/api-client.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext('(function(module,exports){'+source+'})',{Response,Headers,fetch:async(url,opts)=>{lastOptions=opts;if(response instanceof Error)throw response;return response}})(moduleObject,moduleObject.exports);
const {apiFetch,readApiResponse}=moduleObject.exports;
(async()=>{
assert.equal((await readApiResponse(Response.json({contacts:[],messages:[]}))).contacts.length,0);
await assert.rejects(()=>readApiResponse(new Response('<!DOCTYPE html><html>Sign in</html>',{headers:{'content-type':'text/html'}})),e=>e.code==='unexpected_response'&&!e.message.includes('Unexpected token'));
await assert.rejects(()=>readApiResponse({type:'opaqueredirect'}),e=>e.code==='auth_required');
await assert.rejects(()=>readApiResponse(Response.json({error:'Login'},{status:401})),e=>e.code==='auth_required');
await assert.rejects(()=>readApiResponse(Response.json({error:'Ruxsat yo‘q'},{status:403})),e=>e.code==='forbidden'&&e.message==='Ruxsat yo‘q');
await assert.rejects(()=>readApiResponse(new Response('<html>Gateway failure</html>',{status:502,headers:{'content-type':'text/html'}})),e=>e.code==='server_error');
await assert.rejects(()=>readApiResponse(new Response('broken',{headers:{'content-type':'application/json'}})),e=>e.code==='invalid_response');
response=Response.json({ok:true});assert.equal((await apiFetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).ok,true);assert.equal(lastOptions.redirect,'manual');assert.equal(lastOptions.credentials,'same-origin');assert.equal(lastOptions.headers.get('Accept'),'application/json');assert.equal(lastOptions.headers.get('Content-Type'),'application/json');
response=new Error('Internal network detail');await assert.rejects(()=>apiFetch('/api/chat'),e=>e.code==='network'&&!e.message.includes('Internal'));
console.log('9 API response and session recovery scenarios passed');
})().catch(e=>{console.error(e);process.exit(1)});
