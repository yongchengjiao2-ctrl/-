import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {bindPrompt} from '../src/shot-asset-bindings.js';
import {mainPrompt} from '../src/storyboard-detail-contract.js';
import {normalizeDetailedRows} from '../src/storyboard-detail-normalize.js';
const assets=[{id:'p',title:'林岚',category:'character',pending:true},{id:'s',title:'废弃医院',category:'environment',pending:true}];
test('renderer and binder pending declarations collapse to one host introduction, including scene-only lines',()=>{
 const text='(@林岚 是林岚)；(@废弃医院 是废弃医院)；本Seq场景为@废弃医院\n\n；本Seq场景为@废弃医院\n\n场景是废弃医院，地板有水迹。\n林岚站立。';
 const once=bindPrompt(text,assets);
 assert.equal((once.match(/ 是林岚/g)||[]).length,1);assert.equal((once.match(/本Seq场景为/g)||[]).length,1);
 assert.ok(once.includes('场景是@废弃医院，地板有水迹。'));
 assert.equal(bindPrompt(once,assets),once);
});
test('complete-looking declarations with additional ordinary prose are never stripped',()=>{
 for(const line of ['；本Seq场景为@废弃医院，地板有水迹。','(@林岚 是林岚)；她在地板水迹旁站立。','本Seq场景为废弃医院，地板有水迹。']){
  const out=bindPrompt(line+'\n林岚站立。',assets);
  assert.ok(out.includes('地板有水迹')||out.includes('地板水迹旁站立'));
  assert.ok(out.includes(line.startsWith('本Seq场景为废弃')?'本Seq场景为@废弃医院':'地板'));
 }
});
test('actual repair live model fixture keeps water-stain prose and normalizes to a single introduction idempotently',()=>{
 const fixture=JSON.parse(fs.readFileSync(new URL('../../影策审计-20261025/repair-live-storyboard-complete.json',import.meta.url),'utf8'));
 const once=normalizeDetailedRows(fixture.rows,[]),twice=normalizeDetailedRows(once,[]);
 assert.deepEqual(twice,once);
 once.forEach((row,i)=>{
  const main=mainPrompt(row.videoMotionPrompt);
  assert.equal((main.match(/本Seq场景为/g)||[]).length,1,'row '+i);
  assert.equal((main.match(/ 是@?林岚/g)||[]).length,1,'row '+i);
  assert.ok(main.includes('地面带有斑驳陈旧的水迹与灰尘'));
  assert.ok(main.includes('左后地面水迹'));
  assert.ok(!main.includes(' 是@林岚'));
 });
});
