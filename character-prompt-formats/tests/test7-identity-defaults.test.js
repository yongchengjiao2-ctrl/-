import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {normalizeIdentityFields,assertIdentityFields}from '../src/asset-provenance.js';
const dir=fs.readFileSync(new URL('../build/current-test7-fix-path.txt',import.meta.url),'utf8').trim();
const rows=JSON.parse(fs.readFileSync(dir+'/replay-report.json','utf8'));
test('test7 actual missing scene identity succeeds in corrected recovery path',()=>{
 const row=rows.find(r=>r.id==='8693cc1a40083435d95998c91c8ea516');assert.match(row.oldError,/identityName/);assert.equal(row.passed,true);
 const d=JSON.parse(fs.readFileSync(dir+'/'+row.id+'.validated.json','utf8')).data;
 assert.equal(d.scenes[0].identityName,d.scenes[0].name);assert.equal(d.scenes[0].entityType,'environment');assert.equal(d.scenes[0].variantName,'');
});
test('valid model identity and costume stay unchanged while missing fields default locally',()=>{
 const d=normalizeIdentityFields({characters:[{name:'周虎',identityName:'周虎',entityType:'character',variantName:'飞鱼服'}],scenes:[{name:'皇宫-太和殿',description:'大殿',prompt:'完整场景设定'}],props:[]});assertIdentityFields(d);assert.equal(d.characters[0].variantName,'飞鱼服');assert.equal(d.scenes[0].identityName,'皇宫-太和殿');
});
test('unrelated real source coverage failure is not hidden by identity defaults',()=>{
 const r=rows.find(r=>r.id==='87956032d2901dea20cd28bf7ac13865');assert.equal(r.passed,false);assert.match(r.error,/覆盖不完整/);
});
test('frozen patch normalizes both submit and refresh before assertion without upgrading old contract',()=>{
 const s=fs.readFileSync(dir+'/stage/asset-extraction-runtime-v3.js','utf8');assert.equal((s.match(/RFNormalizeIdentity\(annotateResult\(validateAssets\(/g)||[]).length,2);assert.ok(s.includes('extractionContractVersion:5'));assert.ok(!s.includes('extraction-source-inventory.js'));
});
