import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createChapterGenerationRegistry} from '../src/chapter-generation-control.js';
import {generatePlannedChapter} from '../src/storyboard-planned-runtime-audit-v3.js';
const args={projectId:'review-isolation',chapterId:'chapter',screenplayText:'场景：仓库\n△画面：仓库门关闭。',config:{model:'m',channels:[{id:'test',models:['m'],interfaceType:'a6api-chat'}]}};

test('explicit retry retires task A; delayed A status cannot overwrite or cancel task B',async()=>{
 const cancelled=[],registry=createChapterGenerationRegistry({cancelTask:async id=>{cancelled.push(id);return{id,status:'cancelled',providerCancelStatus:'unsupported'}}}),handle=registry.start(args.projectId,args.chapterId);let submits=0,reviews=0,retries=0;
 const pending=generatePlannedChapter(args,{signal:handle.signal,onTaskUpdate:handle.onTaskUpdate,onReviewRetry:()=>{retries++;handle.beginRetry();}},{prepare:async p=>({...p,metadata:{}}),textConfig:c=>c,reviewStorage:{getItem:()=>null,setItem:()=>{}},createTask:async()=>{submits++;if(submits===2){handle.onTaskUpdate({id:'A',status:'cancelled'});assert.equal(registry.get(args.projectId,args.chapterId).taskId,null);assert.equal(handle.signal.aborted,false);}return{id:submits===1?'A':'B',status:'succeeded',resultJson:'{"text":"{}"}'}},queryTask:async()=>{throw Error('unexpected query')},reviewDraft:async draft=>{reviews++;assert.ok(draft.text==='{}');if(reviews===1)return'retry';handle.onTaskUpdate({id:'A',status:'failed',error:'late A'});assert.equal(registry.get(args.projectId,args.chapterId).taskId,'B');assert.equal(registry.get(args.projectId,args.chapterId).status,'succeeded');return'ack';}});
 await assert.rejects(pending,/待复核草稿/);assert.equal(submits,2);assert.equal(retries,1);assert.equal(reviews,2);assert.deepEqual(cancelled,[]);
});

test('a retry hook failure cannot submit task B and unknown review choices never imply retry',async()=>{
 for(const choice of ['Retry','retry ','download','ack',undefined]){let submits=0,hooks=0;await assert.rejects(generatePlannedChapter({...args,chapterId:'choice-'+String(choice)},{onReviewRetry:()=>hooks++},{prepare:async p=>({...p,metadata:{}}),textConfig:c=>c,createTask:async()=>{submits++;return{id:'A',status:'succeeded',resultJson:'{"text":"{}"}'}},reviewDraft:async()=>choice,reviewStorage:{getItem:()=>null,setItem:()=>{}}}));assert.equal(submits,1);assert.equal(hooks,0);}
 let count=0;await assert.rejects(generatePlannedChapter({...args,chapterId:'hook-failure'},{onReviewRetry:()=>{throw Error('generation replaced')}},{prepare:async p=>({...p,metadata:{}}),textConfig:c=>c,createTask:async()=>{count++;return{id:'A',status:'succeeded',resultJson:'{"text":"{}"}'}},reviewDraft:async()=> 'retry',reviewStorage:{getItem:()=>null,setItem:()=>{}}}),/generation replaced/);assert.equal(count,1);
});

test('chapter wrapper routes review retry and task events through one generation handle',()=>{
 const source=fs.readFileSync(new URL('../src/chapters-CeKTBaiU.js',import.meta.url),'utf8');const block=source.slice(source.indexOf('async function bn('),source.indexOf('async function xn('));
 assert.ok(block.includes('signal:control.signal'));assert.ok(block.includes('onReviewRetry:()=>control.beginRetry()'));assert.ok(block.includes('control.onTaskUpdate(task)'));assert.ok(block.includes('control.finish(failure)'));
});
