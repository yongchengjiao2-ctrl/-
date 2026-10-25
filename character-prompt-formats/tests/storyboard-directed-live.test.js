import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{parsePlannedText,planScript,renderPlanned}from'../src/storyboard-planned.js';import{auditDetailed,copyFromMain}from'../src/storyboard-detail-contract.js';import{normalizeDetailedRows}from'../src/storyboard-detail-normalize.js';
const base=new URL('../build/test-six/',import.meta.url),read=n=>JSON.parse(fs.readFileSync(new URL(n,base))),input=read('input.json');
test('director parser fixes only key quotes/trailing commas and refuses incomplete output',()=>{
 const text='{\n"action":"保留原文。",\ngazeHands": "视线看向门口",\n}';assert.deepEqual(parsePlannedText(text),{action:'保留原文。',gazeHands:'视线看向门口'});assert.throws(()=>parsePlannedText('{"segments":['));
});
test('actual selected director API results preserve full dialogue, variable <=15s segments, detailed internal shots and independent references',()=>{
 for(let i=1;i<=3;i++){
  const run=`chapter-${i}-directed-${i===3?'v7':'v8'}`,provider=read(run+'.response.json'),model=parsePlannedText(provider.choices[0].message.content),plan=planScript(input.units[i-1].source_text),result=renderPlanned(model,plan);
  assert.equal(provider.choices[0].finish_reason,'stop');assert.equal(result.rows.map(r=>r.dialogue).join(''),plan.voice);assert.ok(new Set(plan.segments.map(s=>s.duration)).size>1);
  for(let j=0;j<result.rows.length;j++){
   const row=result.rows[j],segment=plan.segments[j];assert.ok(row.durationSeconds>0&&row.durationSeconds<=15);assert.equal(segment.shots.map(s=>s.voice).join(''),row.dialogue);assert.ok(segment.shots.every(s=>s.duration>=2&&s.duration<=5));assert.deepEqual(auditDetailed(row,{requireCopy:true}),[]);
   assert.equal(new Set(row.referenceInfo.map(a=>a.description)).size,row.referenceInfo.length);assert.ok(row.referenceInfo.some(a=>a.category==='environment'));assert.ok(row.videoMotionPrompt.includes('【本段人物、场景与道具】'));assert.ok(!/嘴唇微动配合OS/.test(row.videoMotionPrompt));
   const saved=normalizeDetailedRows([row],[])[0];for(const a of row.referenceInfo)assert.ok(saved.videoMotionPrompt.includes('@'+a.name));assert.ok(copyFromMain(saved.videoMotionPrompt).includes('【分镜详情】'));
  }
 }
});
