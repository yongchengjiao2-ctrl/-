import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {annotateResult} from '../src/character-prompt-formats.js';
import {parseExtractionJSON} from '../src/extraction-recovery.js';
import {assertSourceCoverage,assertFormatCompleteness} from '../src/extraction-completeness-v4.js';
const dir=new URL('../build/managed-verify/',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,dir),'utf8'));
test('real DeepSeek stop response is rejected for incomplete JSON',()=>{
 const response=read('task-eb21487c4bdc96d686207046a917533c.provider-response.json');
 assert.equal(response.choices[0].finish_reason,'stop');
 assert.throws(()=>parseExtractionJSON(response.choices[0].message.content),/截断/);
});
test('real Gemini first-pass JSON is valid but fails the chapter coverage check',()=>{
 const data=read('gemini-3.1-pro-preview-original.assets.json');
 assert.throws(()=>assertSourceCoverage(data,read('verified-setup.json').source),/覆盖不完整/);
});
test('real Gemini four-panel and dual-panel results preserve all required role sections',()=>{
 for(const id of ['four-panel','side-portrait']){
  const data=read(`verified-gemini-3.1-pro-preview-${id}.assets.json`);
  assertSourceCoverage(data,read('verified-setup.json').source);
  assertFormatCompleteness(data,{id});
  for(const character of data.characters)for(const n of [22,23,24])assert.ok(character.multiViewPrompt.includes('['+n+'.'));
 }
});

test('real original response receives the exact managed five-view layout without another model call',()=>{
 const data=read('compact-gemini-3.1-pro-preview-original.assets.json');
 const format={...read('verified-setup.json').formats.find(f=>f.id==='original'),fixedLayoutManaged:true};
 const complete=annotateResult(data,format);
 assertSourceCoverage(complete,read('verified-setup.json').source);
 for(const character of complete.characters)for(const text of ['【人物排版】','无头','正面','背面','45度'])assert.ok(character.multiViewPrompt.includes(text));
 assert.deepEqual(annotateResult(complete,format),complete);
 assert.equal(complete.scenes,data.scenes);assert.equal(complete.props,data.props);
});
