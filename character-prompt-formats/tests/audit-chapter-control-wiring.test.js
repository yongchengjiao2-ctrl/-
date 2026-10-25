import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
import {createChapterGenerationRegistry} from '../src/chapter-generation-control.js';
const source=fs.readFileSync(new URL('../src/chapters-CeKTBaiU.js',import.meta.url),'utf8');const fn=source.slice(source.indexOf('async function bn('),source.indexOf('async function xn('));
test('compiled chapter wrapper connects actual signal and task updates, keeps running task visible after failure',async()=>{
 const registry=createChapterGenerationRegistry({cancelTask:async id=>({id,status:'cancelled'})});let received;
 const generate=new Function('RFPlannedChapter','RFAuditBeginChapter','Tt','lt','ot','it',fn+';return bn;')(async(e,c)=>{received=c; c.onTaskUpdate({id:'t',status:'running'});throw Error('lost connection');},(p,c)=>registry.start(p,c),{prepare:async()=>{}},()=>{},()=>{},x=>x);
 await assert.rejects(generate({projectId:'p',chapterId:'c'},{}),/lost connection/);assert.ok(received.signal instanceof AbortSignal);assert.equal(registry.get('p','c').active,true);
 await registry.cancel('p','c');assert.equal(received.signal.aborted,true);assert.equal(registry.get('p','c').status,'cancelled');
});
test('compiled chapter renders task controls outside the generation modal and never claims validation success',()=>{
 assert.equal(source.split('(0,$.jsx)(RFAuditChapterControl,').length-1,1);assert.ok(source.includes('projectId:e.project.id,chapterId:V.id}'));
 const control=fs.readFileSync(new URL('../src/chapter-generation-control.js',import.meta.url),'utf8');assert.ok(control.includes('分镜是否保存以章节验收结果为准'));
});
