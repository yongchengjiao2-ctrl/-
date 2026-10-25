import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceCoverage,assertSourceCoverage,assertFormatCompleteness} from '../src/extraction-completeness-v4.js';
test('parenthesized named people and scene spaces are kept separate',()=>{
 const variables={'章节正文':'场景：天津·街头与省公署门前\n人物：周恩来、律师（钱俊、兰兴周、刘崇佑）、旁听席\n△画面：各界群众欢迎，走出法院大门。'};
 const coverage=sourceCoverage(variables);
 assert.ok(coverage.people.includes('钱俊'));assert.ok(coverage.people.includes('兰兴周'));assert.ok(coverage.people.includes('刘崇佑'));
 assert.deepEqual(coverage.scenes,['天津·街头','省公署门前','法院大门外']);
 assert.throws(()=>assertSourceCoverage({characters:[],scenes:[]},variables),/覆盖不完整/);
});
test('complete labeled roles pass, short layout-only response fails',()=>{
 assert.throws(()=>assertFormatCompleteness({characters:[{name:'甲',multiViewPrompt:'[0.画面要求]白底四联'}]},{id:'four-panel'}),/第1节/);
 const text=Array.from({length:22},(_,i)=>`[${i}.设定]实际内容`).join('\n');
 assert.doesNotThrow(()=>assertFormatCompleteness({characters:[{name:'甲',multiViewPrompt:text}]},{id:'side-portrait'}));
});
