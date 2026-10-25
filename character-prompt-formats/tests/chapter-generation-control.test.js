import test from 'node:test';import assert from 'node:assert/strict';
import {createChapterGenerationRegistry,ChapterGenerationControl,saveChapterGenerationReport,readChapterGenerationReport} from '../src/chapter-generation-control.js';
test('F20 no task is hidden and pre-submit stop aborts locally without invoking backend cancellation',async()=>{
 let calls=0;const registry=createChapterGenerationRegistry({cancelTask:()=>{calls++;}});
 assert.equal(registry.get('p','c'),null);
 const handle=registry.start('p','c');assert.equal(handle.signal.aborted,false);
 await registry.cancel('p','c');assert.equal(handle.signal.aborted,true);assert.equal(calls,0);
 assert.equal(registry.get('p','c').phase,'stopped-before-submit');assert.equal(registry.get('p','c').status,null);
 handle.finish(new DOMException('Aborted','AbortError'));assert.equal(registry.get('p','c').phase,'stopped-before-submit');
});
test('F20 backend confirmed cancellation aborts polling and distinguishes provider cancellation',async()=>{
 const calls=[];const registry=createChapterGenerationRegistry({cancelTask:async id=>{calls.push(id);return{id,status:'cancelled',providerCancelStatus:'unknown'};}});
 const handle=registry.start('p','c');handle.onTaskUpdate({id:'task',status:'running'});
 await registry.cancel('p','c');assert.deepEqual(calls,['task']);assert.equal(handle.signal.aborted,true);
 assert.equal(registry.get('p','c').status,'cancelled');assert.equal(registry.get('p','c').providerCancelStatus,'unknown');
});
test('F20 running cancellation response does not abort until a later task update confirms cancellation',async()=>{
 const registry=createChapterGenerationRegistry({cancelTask:async id=>({id,status:'running'})});
 const handle=registry.start('p','c');handle.onTaskUpdate({id:'t',status:'running'});
 await registry.cancel('p','c');assert.equal(handle.signal.aborted,false);assert.equal(registry.get('p','c').phase,'cancelling');
 handle.onTaskUpdate({id:'t',status:'cancelled'});assert.equal(handle.signal.aborted,true);
});
test('F20 cancellation error remains visible after frontend finish and may be retried',async()=>{
 let calls=0;const registry=createChapterGenerationRegistry({cancelTask:async id=>{calls++;if(calls===1)throw Error('网络断开');return{id,status:'cancelled'};}});
 const handle=registry.start('p','c');handle.onTaskUpdate({id:'t',status:'running'});
 await assert.rejects(registry.cancel('p','c'),/网络断开/);handle.finish(Error('等待失败'));
 assert.equal(registry.get('p','c').active,true);assert.equal(registry.get('p','c').status,'running');assert.equal(handle.signal.aborted,false);
 assert.throws(()=>registry.start('p','c'),/仍有分镜任务/);
 await registry.cancel('p','c');assert.equal(handle.signal.aborted,true);assert.equal(calls,2);
});
test('F20 a completion race is reported as succeeded and does not become cancelled',async()=>{
 let resolve;const registry=createChapterGenerationRegistry({cancelTask:()=>new Promise(r=>resolve=r)});
 const handle=registry.start('p','c');handle.onTaskUpdate({id:'t',status:'running'});
 const promise=registry.cancel('p','c');await Promise.resolve();resolve({id:'t',status:'succeeded'});await promise;
 assert.equal(handle.signal.aborted,false);assert.equal(registry.get('p','c').status,'succeeded');
});
test('F20 duplicate cancellation shares one request; stale generation updates cannot change a later task',async()=>{
 let calls=0,resolve;const registry=createChapterGenerationRegistry({cancelTask:()=>{calls++;return new Promise(r=>resolve=r);}});
 const old=registry.start('p','c');old.onTaskUpdate({id:'t',status:'running'});
 const a=registry.cancel('p','c'),b=registry.cancel('p','c');assert.equal(a,b);await Promise.resolve();assert.equal(calls,1);
 resolve({id:'t',status:'cancelled'});await a;
 const current=registry.start('p','c');old.onTaskUpdate({id:'t',status:'succeeded'});old.finish();
 assert.equal(registry.get('p','c').generation,current.generation);assert.equal(registry.get('p','c').phase,'preparing');
});
test('F20 invalid cancellation payload cannot claim success and chapter states stay independent',async()=>{
 const registry=createChapterGenerationRegistry({cancelTask:async()=>({ok:true})});
 const a=registry.start('p','a'),b=registry.start('p','b');a.onTaskUpdate({id:'ta',status:'running'});b.onTaskUpdate({id:'tb',status:'running'});
 await assert.rejects(registry.cancel('p','a'),/有效任务状态/);assert.equal(a.signal.aborted,false);assert.equal(b.signal.aborted,false);
 assert.equal(registry.get('p','b').cancelRequested,false);
});
test('F20 a task ID arriving after local stop triggers real cancellation and stale running does not revive a terminal task',async()=>{
 const calls=[];const registry=createChapterGenerationRegistry({cancelTask:async id=>{calls.push(id);return{id,status:'cancelled'};}});
 const handle=registry.start('p','c');await registry.cancel('p','c');
 handle.onTaskUpdate({id:'late',status:'running'});
 await registry.cancel('p','c');assert.deepEqual(calls,['late']);assert.equal(registry.get('p','c').status,'cancelled');
 handle.onTaskUpdate({id:'late',status:'running'});assert.equal(registry.get('p','c').status,'cancelled');assert.equal(registry.get('p','c').active,false);
});
test('F20 React control stays absent without a registry entry and exposes only independent cancellation UI',()=>{
 const React={useState:()=>[0,()=>{}],useEffect:()=>{},createElement:(type,props,...children)=>({type,props,children})};
 const registry=createChapterGenerationRegistry();assert.equal(ChapterGenerationControl({react:React,projectId:'p',chapterId:'c',registry}),null);
 registry.start('p','c');const ui=ChapterGenerationControl({react:React,projectId:'p',chapterId:'c',registry});
 assert.equal(ui.props['aria-label'],'本章分镜任务控制');assert.ok(JSON.stringify(ui).includes('取消本次分镜任务'));
});
test('completed task displays the persisted non-blocking generation difference report',()=>{
 const data=new Map(),storage={setItem:(k,v)=>data.set(k,v),getItem:k=>data.get(k)||null};
 assert.equal(saveChapterGenerationReport('p','c',{status:'有差异，已直接保存',issues:['第1镜为2秒']},storage),true);
 assert.deepEqual(readChapterGenerationReport('p','c',storage).issues,['第1镜为2秒']);
 const old=globalThis.localStorage;globalThis.localStorage=storage;
 try{const React={useState:()=>[0,()=>{}],useEffect:()=>{},createElement:(type,props,...children)=>({type,props,children})},registry=createChapterGenerationRegistry(),handle=registry.start('p','c');handle.onTaskUpdate({id:'done',status:'succeeded'});const ui=ChapterGenerationControl({react:React,projectId:'p',chapterId:'c',registry});assert.ok(JSON.stringify(ui).includes('生成差异报告'));assert.ok(JSON.stringify(ui).includes('第1镜为2秒'));}finally{globalThis.localStorage=old;}
});

test('F20 only an explicit unfinished terminal review retry can switch task IDs and cancel the new task',async()=>{
 const calls=[];const registry=createChapterGenerationRegistry({cancelTask:async id=>{calls.push(id);return{id,status:'cancelled'};}});
 const handle=registry.start('p','c');handle.onTaskUpdate({id:'A',status:'running'});
 assert.throws(()=>handle.beginRetry(),/不能开始重试/);
 handle.onTaskUpdate({id:'A',status:'succeeded'});
 handle.onTaskUpdate({id:'B',status:'running'});assert.equal(registry.get('p','c').taskId,'A');
 handle.beginRetry();assert.equal(registry.get('p','c').phase,'preparing');
 handle.onTaskUpdate({id:'A',status:'succeeded'});assert.equal(registry.get('p','c').taskId,null);
 handle.onTaskUpdate({id:'B',status:'running'});assert.equal(registry.get('p','c').taskId,'B');
 await registry.cancel('p','c');assert.deepEqual(calls,['B']);assert.equal(handle.signal.aborted,true);
 assert.throws(()=>handle.beginRetry(),/不能开始重试/);
 const next=registry.start('p','c');next.onTaskUpdate({id:'C',status:'succeeded'});next.finish();assert.throws(()=>next.beginRetry(),/不能开始重试/);
});

test('F20 cancelling preparation after explicit retry never sends cancel for the completed prior task',async()=>{
 const calls=[];const registry=createChapterGenerationRegistry({cancelTask:async id=>{calls.push(id);return{id,status:'cancelled'};}});
 const handle=registry.start('p','c');handle.onTaskUpdate({id:'A',status:'succeeded'});handle.beginRetry();
 await registry.cancel('p','c');assert.equal(handle.signal.aborted,true);assert.deepEqual(calls,[]);
 handle.onTaskUpdate({id:'B',status:'running'});await registry.cancel('p','c');assert.deepEqual(calls,['B']);
});
