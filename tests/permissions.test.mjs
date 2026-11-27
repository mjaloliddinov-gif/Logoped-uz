import assert from 'node:assert/strict';
import {canStudent} from '../app/lib/permissions.ts';
const s={owner:'t1',data:{parent:'p1',account:'c1'}};
for(const [role,id,expected] of [['parent','p1',true],['parent','p2',false],['logoped','t1',true],['logoped','t2',false],['student','c1',true],['student','c2',false],['pending','p1',false],['admin','a1',false]])assert.equal(canStudent({role,id,email:'test'},s),expected);
console.log('8 role isolation checks passed');
