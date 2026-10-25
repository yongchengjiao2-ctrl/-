import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
import{directorSource,renderDirector}from'../src/storyboard-autonomous-director.js';
import{validateStoryboardRows}from'../src/storyboard-complete.js';

const source=directorSource('场景：诏狱-牢房\n人物：顾凌天\n△画面：顾凌天站在牢房。\n顾凌天：开门。');
const base=JSON.parse(fs.readFileSync(new URL('../build/test-six/chapter-1-directed-v8.model.json',import.meta.url))).segments[0];

test('source speech mismatch is advisory and the returned model wording remains savable',()=>{
 const shot={...structuredClone(base.shots[0]),duration:6,voices:[{speechId:1,text:'开门吧。',onScreen:true}]};
 const raw={title:'测试',segments:[{...structuredClone(base),id:1,scene:'诏狱-牢房',sourceBeats:[1],totalDuration:6,shots:[shot]}]};
 const result=renderDirector(raw,source);
 assert.equal(result.rows[0].dialogue,'开门吧。');
 assert.equal(result.rows[0].durationSeconds,6);
 assert.ok(result.auditReport.issues.some(x=>x.includes('原文发言1')));
 assert.ok(result.auditReport.issues.some(x=>x.includes('全部内部镜头都超过5秒')));
 assert.doesNotThrow(()=>validateStoryboardRows(result.rows,[],source.text));
});
