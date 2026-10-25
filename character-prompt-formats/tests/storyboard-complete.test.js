import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {completeConfig,completeMetadata,waitComplete,catalogRules,STORYBOARD_PROTOCOL} from '../src/storyboard-complete.js';
test('only the selected configured protocol gets non-stream JSON options; original configuration stays unchanged',()=>{
 const original={model:'a::deepseek-v4-pro-0813',channels:[{id:'a',models:['deepseek-v4-pro-0813'],interfaceType:STORYBOARD_PROTOCOL},{id:'b',models:['gemini-3.1-pro-preview'],interfaceType:'other'}]};
 const next=completeConfig(original);assert.equal(original.channels[0].interfaceType,STORYBOARD_PROTOCOL);assert.equal(next.channels[0].interfaceType,STORYBOARD_PROTOCOL);assert.equal(next.channels[1],original.channels[1]);
 const options=next.channels[0].modelCosts[0].defaultOptions;assert.equal(options.stream,false);assert.equal(options.thinking.type,'disabled');assert.equal(options.response_format.type,'json_object');
 assert.equal(completeMetadata('gemini-3.1-pro-preview').providerOptions[STORYBOARD_PROTOCOL].thinking,undefined);
});
test('waits past running states and exposes final text only, without a fixed deadline or event stream',async()=>{
 const seen=[],states=[{status:'running',textDraft:'partial'},{status:'succeeded',resultJson:'{"text":"complete"}'}];
 const result=await waitComplete('task',{initialTask:{status:'queued'},intervalMs:1,queryTask:async()=>states.shift(),onTaskUpdate:s=>seen.push(s)});
 assert.equal(result.status,'succeeded');assert.ok(seen.every(s=>!('textDraft'in s)));assert.equal(seen.at(-1).resultJson,result.resultJson);
 await assert.rejects(waitComplete('failed',{initialTask:{status:'failed',error:'upstream failed'},queryTask:async()=>{throw Error('must not query')}}),/upstream failed/);
});
test('cancellation remains available during an unbounded wait',async()=>{
 const controller=new AbortController();const pending=waitComplete('task',{initialTask:{status:'running'},intervalMs:10000,signal:controller.signal,queryTask:async()=>({status:'running'})});controller.abort();await assert.rejects(pending,{name:'AbortError'});
});
test('pending scenes get named mentions and never fabricated binding IDs',()=>{
 const text=catalogRules([{id:'scene-id',title:'已确认场景',category:'environment'},{id:'candidate:private',title:'待确认场景',category:'environment',pending:true}]);assert.ok(text.includes('@[asset:scene-id]'));assert.ok(text.includes('@待确认场景'));assert.ok(!text.includes('candidate:private'));
});
test('installed chapter sends false to backend and does not subscribe to text events',()=>{
 const assets=path.join(process.env.LOCALAPPDATA,'YingceCanvas/versions/1.3.13/web/dist/assets');const code=fs.readFileSync(path.join(assets,'chapters-CeKTBaiU.js'),'utf8');const block=code.slice(code.indexOf('async function bn('),code.indexOf('async function xn('));
 const runtime=fs.readFileSync(path.join(assets,'storyboard-planned-runtime.js'),'utf8');assert.ok(block.includes('RFPlannedChapter'));assert.ok(runtime.includes('textOptions:{stream:false,thinking:false}'));assert.ok(runtime.includes('waitComplete'));assert.ok(!runtime.includes('useTextEvents'));assert.ok(runtime.includes('renderPlanned'));
});
