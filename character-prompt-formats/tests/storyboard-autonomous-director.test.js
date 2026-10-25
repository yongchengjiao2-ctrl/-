import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{directorSource,directorPrompt,directorResponseFormat,renderDirector}from'../src/storyboard-autonomous-director.js';
const source=directorSource('场景：诏狱-牢房\n人物：顾凌天\n△画面：顾凌天蹲在墙角用破陶碗挖土。\n顾凌天(OS)：我会出去。');
test('model receives source ledger without machine-chosen shots or count constraints',()=>{
 assert.deepEqual(source.segments,[]);const prompt=directorPrompt(source,{});assert.ok(!prompt.includes('本次镜头数量清单'));assert.ok(!prompt.includes('不可更改的分段配音时间计划'));const schema=directorResponseFormat().json_schema.schema;assert.equal(schema.properties.segments.maxItems,undefined);assert.equal(schema.properties.segments.items.properties.shots.maxItems,undefined);
});
function result(duration=3,text='我会出去。'){
 const original=JSON.parse(fs.readFileSync(new URL('../build/test-six/chapter-1-directed-v8.model.json',import.meta.url),'utf8')).segments[0];
 return{title:'模型自主选择',segments:[{...original,id:1,scene:'诏狱-牢房',sourceBeats:[1],shots:[{...original.shots[0],duration,voices:[{speechId:1,text,onScreen:false}]}]}]};
}
test('model-selected shot remains single and its duration is not recalculated, including a short exception',()=>{
 for(const duration of [1.9,2,3,5]){const rendered=renderDirector(result(duration),source);assert.equal(rendered.rows.length,1);assert.equal(rendered.rows[0].durationSeconds,duration);assert.equal(rendered.rows[0].dialogue,'我会出去。');}
});
test('missing source words are reported without inventing replacements',()=>{
 const missing=renderDirector(result(3,'我出去。'),source);assert.ok(missing.auditReport.issues.some(x=>x.includes('原文发言1')&&x.includes('我会出去')));
});
