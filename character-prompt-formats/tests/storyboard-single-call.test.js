import test from 'node:test';import assert from 'node:assert/strict';import{oneChapterSubmission,makeSingleModelTask}from '../src/storyboard-single-call.js';import{materializeSpatialDiagrams}from '../src/storyboard-spatial-render.js';
import fs from 'node:fs';import path from 'node:path';
test('actual installed chapter delegates exactly once to the planned runtime',async()=>{
 const src=fs.readFileSync(path.join(process.env.LOCALAPPDATA,'YingceCanvas/versions/1.3.13/web/dist/assets/chapters-CeKTBaiU.js'),'utf8');const fn=src.slice(src.indexOf('async function bn('),src.indexOf('async function xn('));let calls=0;
 const delegate=async(e,t,deps)=>{calls++;assert.equal(e.projectId,'p');assert.equal(typeof deps.createTask,'function');return{rows:[{}]}};
 const generate=new Function('RFPlannedChapter','Tt','lt','ot','it','RFAuditBeginChapter',fn+';return bn;')(delegate,{prepare:async()=>{}},async()=>{},async()=>{},x=>x,()=>({signal:new AbortController().signal,onTaskUpdate:()=>{},finish:()=>{}}));
 assert.equal((await generate({projectId:'p'},{})).rows.length,1);assert.equal(calls,1);
});
test('rapid duplicate submits run once including the final write; explicit later retry is allowed',async()=>{
 let count=0;let finish;const pending=new Promise(r=>finish=r);const work=async()=>{count++;await pending;return 'done'};
 const a=oneChapterSubmission('project:chapter',work),b=oneChapterSubmission('project:chapter',work);await Promise.resolve();assert.equal(count,1);finish();assert.deepEqual(await Promise.all([a,b]),['done','done']);await oneChapterSubmission('project:chapter',work);assert.equal(count,2);
});
test('a failed provider call never causes a second automatic model submission',async()=>{
 let count=0;const submit=makeSingleModelTask(async()=>{count++;throw Error('upstream failed')});await assert.rejects(submit({operation:'text',input:{}}),/upstream/);assert.throws(()=>submit({operation:'text',input:{}}),/阻止重复/);assert.equal(count,1);
 const blocked=makeSingleModelTask(()=>count++);assert.throws(()=>blocked({operation:'storyboard'}),/禁止自动拆段/);assert.equal(count,1);
});
test('a diagram can be drawn locally only when all nine actual spatial cells and camera/light data exist',()=>{
 const text='【场景九宫格】：左前：墙；正前：门；右前：窗；左中：@甲；中心：@乙；右中：桌；左后：地面；正后：摄影机；右后：墙。\n【BGM与跨Seq音频DNA无缝锁总设计】：无\n镜头1（预估本镜：3.0秒 ｜ 本Seq累加: 约3.0秒）：\n【分镜详情】：\n🎥 机位与构图：从门前缓慢推进\n💡 光影与环境：光线来自左侧窗户\n🎭 表演与防穿帮：甲看向乙\n【段尾视觉、坐标体态、轴线与状态锁】：静止';
 const result=materializeSpatialDiagrams(text);assert.ok(result.includes('┌'));assert.ok(result.includes('左中：@甲'));assert.ok(result.includes('本镜机位说明：从门前缓慢推进'));assert.equal(materializeSpatialDiagrams(result),result);
 const missing=text.replace('右后：墙。','');assert.equal(materializeSpatialDiagrams(missing),missing);
});
