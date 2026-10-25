import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DEFAULT_FORMATS,buildExtractionPrompt,annotateResult} from '../src/character-prompt-formats.js';
import {parseExtractionJSON,completeExtraction} from '../src/extraction-recovery.js';
test('actual failed dual response is explicitly diagnosed as truncated',()=>{
 const raw=fs.readFileSync(new URL('../build/result-c8f54db9ec6f8c6b665a32e574d9e571.txt',import.meta.url),'utf8');
 assert.throws(()=>parseExtractionJSON(raw),/响应被截断/);
});
test('same JSON contract accepts real complete response and expands dual layout idempotently',()=>{
 const data=parseExtractionJSON(fs.readFileSync(new URL('../build/latest-extraction.json',import.meta.url),'utf8'));
 const format=DEFAULT_FORMATS.find(f=>f.id==='side-portrait');
 const prompt=buildExtractionPrompt({'章节正文':'正文'},format);
 assert.ok(prompt.includes('【所选版式JSON传输规则'));assert.ok(prompt.includes('【JSON序列化合同】'));
 const result=annotateResult(data,format);
 for(const c of result.characters){assert.ok(c.multiViewPrompt.includes('同一角色两视图'));assert.ok(c.multiViewPrompt.includes('[24.背景与渲染]'));}
 assert.deepEqual(annotateResult(result,format),result);
});
test('rejects invalid field types and malformed closed JSON without extra model request',async()=>{
 assert.throws(()=>parseExtractionJSON('{"characters":{},"scenes":[],"props":[]}'),/characters必须为数组/);
 assert.throws(()=>parseExtractionJSON('{"characters":,}'),/characters必须为数组/);
 await assert.rejects(completeExtraction('{"characters":{},"scenes":[],"props":[]}',{validate:parseExtractionJSON,request:()=>{throw Error('unexpected request')}}),/characters必须为数组/);
});

