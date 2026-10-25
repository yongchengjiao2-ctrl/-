import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sourceScriptContract,assertSourceFidelity} from '../src/source-script-contract.js';
import {validateStoryboardRows} from '../src/storyboard-complete.js';
import {planScript,packedV2PlanScript,renderPlanned} from '../src/storyboard-planned.js';
import {copyFromMain,completePrompt} from '../src/storyboard-detail-contract.js';

test('F02 source ledger keeps narration, named speech without a roster, OS/VO/OV and multiline speech in order',()=>{
 const source='场次：室内\n△画面：两人在桌边。\n甲：第一行。\n第二行。\n旁白（画外音）：旁白。\n乙(OS)：心声。\nVO：远处广播。\n乙（OV）：电话声音。';
 const contract=sourceScriptContract(source);
 assert.equal(contract.voice,'第一行。\n第二行。旁白。心声。远处广播。电话声音。');
 const plan=planScript(source);assert.equal(plan.voice,contract.voice);assert.equal(plan.beats,1);
 assert.doesNotThrow(()=>assertSourceFidelity([{dialogue:contract.voice,sourceBeats:[1]}],source));
 for(const wrong of [contract.voice.replace('第二行。',''),contract.voice+'新增。',contract.voice.replace('第一行。','第一行！')])assert.throws(()=>assertSourceFidelity([{dialogue:wrong,sourceBeats:[1]}],source),/配音/);
 assert.throws(()=>assertSourceFidelity([{dialogue:'完全不同的旧台词。',sourceBeats:[1]}],source),/配音/);
});

test('F02 pure visual scripts reject invented speech and a speech before the first beat fails before model submission',()=>{
 const source='场次：仓库\n△画面：门缓缓打开。';
 assert.doesNotThrow(()=>assertSourceFidelity([{dialogue:'',sourceBeats:[1]}],source));
 assert.throws(()=>assertSourceFidelity([{dialogue:'谁在那里？',sourceBeats:[1]}],source),/配音/);
 assert.throws(()=>planScript('场景：仓库\n甲：开门。\n△画面：门打开。'),/首个画面/);
 assert.equal(sourceScriptContract('旁白：第一句。\n第二句。').voice,'第一句。\n第二句。');
 assert.equal(sourceScriptContract('乙(OS)：心声。').voice,'心声。');
});

test('F03 coverage rejects missing/empty/noninteger/out-of-range/duplicate source beats; permits a beat spanning rows',()=>{
 const source='场次：仓库\n△画面：门打开。\n△画面：甲走出。\n△转场：街头。';
 for(const beats of [undefined,[],['1'],[1.5],[0],[4],[1,1]])assert.throws(()=>assertSourceFidelity([{dialogue:'',sourceBeats:beats}],source),/sourceBeats/);
 assert.throws(()=>assertSourceFidelity([{dialogue:'',sourceBeats:[1,3]}],source),/遗漏原画面2/);
 assert.doesNotThrow(()=>assertSourceFidelity([{dialogue:'',sourceBeats:[1]},{dialogue:'',sourceBeats:[1,2]},{dialogue:'',sourceBeats:[3]}],source));
});

test('F02/F03 real historical valid rows no longer pass against an unrelated script or empty coverage',()=>{
 const dir=new URL('../build/storyboard-detail-v12/',import.meta.url),read=n=>JSON.parse(fs.readFileSync(new URL(n,dir),'utf8'));
 // This test isolates the source gate from F12 identity resolution. The old
 // fixture's overlapping bayonet aliases are intentionally audited elsewhere.
 const rows=read('gemini-rich-2.storyboard.json').rows,catalog=[];
 assert.throws(()=>validateStoryboardRows(rows,catalog,'场次：室内\n△画面：甲站着。\n甲：这句对白必须保留。'),/配音/);
 const speech=rows.map(r=>r.dialogue).join('');
 assert.throws(()=>validateStoryboardRows(rows.map(r=>({...r,sourceBeats:[]})),catalog,'场次：室内\n△画面：甲站着。\n旁白：'+speech),/sourceBeats/);
 assert.doesNotThrow(()=>validateStoryboardRows(rows,catalog,fs.readFileSync(new URL('narration.txt',dir),'utf8')));
});

test('F14 copy removes complete diagrams but keeps ordinary pipe/dash dialogue and heading inline prose',()=>{
 const source='旁白：A─B街区。\n🎥 机位：向前│看齐\n【全息周边环境、机位俯视图】：图后仍需保留的机位说明。\n┌────┐\n│ @甲 ↑ 🎥 │\n└────┘\n对白：向左─向右，A│B。';
 const copy=copyFromMain(source);
 for(const line of ['旁白：A─B街区。','🎥 机位：向前│看齐','图后仍需保留的机位说明。','对白：向左─向右，A│B。'])assert.ok(copy.includes(line));
 assert.ok(!copy.includes('┌'));assert.ok(!copy.includes('全息周边环境'));
 assert.equal(completePrompt(completePrompt(source)),completePrompt(source));
 assert.equal(copyFromMain('旁白：┌故事未完。\n│人物继续走。'),'旁白：┌故事未完。\n│人物继续走。');
});

test('planned renderer independently checks the plan source, not only the plan transcript',()=>{
 const dir=new URL('../build/test-six/',import.meta.url),input=JSON.parse(fs.readFileSync(new URL('input.json',dir),'utf8'));
 for(let i=0;i<3;i++){
  // Replay with the historical planner that produced this saved model result;
  // the current planner may legitimately create a different shot/segment plan.
  const plan=packedV2PlanScript(input.units[i].source_text),raw=JSON.parse(fs.readFileSync(new URL(`chapter-${i+1}-packed-v2.model.json`,dir),'utf8'));
  const result=renderPlanned(raw,plan);assert.doesNotThrow(()=>assertSourceFidelity(result.rows,input.units[i].source_text));
  assert.throws(()=>renderPlanned(raw,{...plan,text:plan.text+'\n旁白：绝不能遗漏的新句。'}),/配音/);
 }
});

test('source visual continuation, stage directions and non-speech notes stay in locked visuals',()=>{
 const source='场景：仓库\n△画面：甲站在门口。\n他拾起钥匙。\n甲：第一句。\n（甲走向门边）\n【旁白】：门开了。\n【乙】：第二句。\n提示：门不可再次打开。\n【说明】：钥匙仍在甲手中。\n注意：保持左手持物。';
 const ledger=sourceScriptContract(source),plan=planScript(source);
 assert.equal(ledger.voice,'第一句。门开了。第二句。');assert.equal(plan.voice,ledger.voice);
 for(const text of ['他拾起钥匙。','（甲走向门边）','提示：门不可再次打开。','【说明】：钥匙仍在甲手中。','注意：保持左手持物。'])assert.ok(plan.entries.every(e=>e.visual.includes(text)),text);
 assert.equal(ledger.unclassified.length,0);
});

test('ambiguous unlabelled speech continuations are diagnosed and pre-beat prose is rejected',()=>{
 const source='场景：仓库\n△画面：甲站在门口。\n甲：第一句。\n第二句。';
 const plan=planScript(source);assert.equal(plan.voice,'第一句。\n第二句。');assert.equal(plan.diagnostics[0].code,'unlabelled-speech-continuation');
 assert.throws(()=>planScript('场景：仓库\n这一段用途不明确。\n△画面：甲站在门口。'),/用途不明确/);
});
