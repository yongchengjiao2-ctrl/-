import test from 'node:test';
import assert from 'node:assert/strict';
import {generatePlannedChapter} from '../src/storyboard-planned-runtime.js';
import {waitComplete} from '../src/storyboard-complete.js';

const args=id=>({projectId:'audit-cancel',chapterId:id,screenplayText:'场景：仓库\n人物：甲\n△画面：甲站在门口。\n甲：请开门。',config:{model:'audit::model',channels:[{id:'audit',models:['model'],interfaceType:'a6api-chat'}]},skills:[],selectedSkillIds:[],assets:[]});
const dependencies=(createTask,queryTask)=>({prepare:async()=>({prompt:'locked prompt',metadata:{},selectedSkills:[]}),createTask,queryTask,textConfig:c=>c});

test('F20 runtime callback signal stops waiting after task creation without a second model submission',async()=>{
 const controller=new AbortController();let created=0,queried=0;
 await assert.rejects(generatePlannedChapter(args('after-create'),{signal:controller.signal,onTaskUpdate:()=>controller.abort()},dependencies(async()=>{created++;return{id:'cancelled-wait',status:'running'}},async()=>{queried++;return{status:'running'}})),{name:'AbortError'});
 assert.equal(created,1);assert.equal(queried,0);
});

test('F20 runtime request signal also stops waiting and provider cancellation remains a separate operation',async()=>{
 const controller=new AbortController();let created=0;
 await assert.rejects(generatePlannedChapter({...args('request-signal'),signal:controller.signal},{onTaskUpdate:()=>controller.abort()},dependencies(async()=>{created++;return{id:'request-signal',status:'running'}},async()=>{throw Error('must not query')})),{name:'AbortError'});
 assert.equal(created,1);
});

test('F20 a failed query propagates without automatically creating another model task',async()=>{
 let created=0,queried=0;
 await assert.rejects(generatePlannedChapter(args('query-failure'),{},dependencies(async()=>{created++;return{id:'query-failure',status:'running'}},async()=>{queried++;throw Error('task service unavailable')})),/task service unavailable/);
 assert.equal(created,1);assert.equal(queried,1);
});

test('F20 waitComplete forwards AbortSignal to the task query and strips intermediate draft text',async()=>{
 const controller=new AbortController(),updates=[];let calls=0;
 const pending=waitComplete('audit',{signal:controller.signal,intervalMs:1,initialTask:{status:'running',textDraft:'partial'},onTaskUpdate:s=>updates.push(s),queryTask:async(id,options)=>{calls++;assert.equal(options.signal,controller.signal);controller.abort();throw new DOMException('Aborted','AbortError')}});
 await assert.rejects(pending,{name:'AbortError'});assert.equal(calls,1);assert.ok(updates.every(s=>!('textDraft'in s)));
});
