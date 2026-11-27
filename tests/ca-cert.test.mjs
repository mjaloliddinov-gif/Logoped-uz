import assert from 'node:assert/strict';import {X509Certificate} from 'node:crypto';import {readFileSync} from 'node:fs';
const ts=(await import('typescript')).default;
const src=ts.transpileModule(readFileSync('app/lib/postgres.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText.replace(/^import .*$/mg,'');
const {caCertificates}=await import('data:text/javascript,'+encodeURIComponent(src));
const pem=readFileSync('tests/fixtures/test-ca.pem','utf8');
const cases=[pem,pem.replace(/\n/g,'\r\n'),pem.replace(/\n/g,'\\n'),'"'+pem.trim()+'"',pem.replace(/\n/g,' '),'  '+pem+pem];
let n=0;for(const c of cases){const out=caCertificates(c);assert.ok(out.length>=1);for(const o of out)new X509Certificate(o);n++}
assert.deepEqual(caCertificates(''),[]);assert.deepEqual(caCertificates(undefined),[]);assert.deepEqual(caCertificates('garbage'),[]);
console.log((n+3)+' CA certificate parsing checks passed');
