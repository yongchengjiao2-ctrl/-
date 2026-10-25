import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
import {planScript,parsePlannedText,plannedPrompt,renderPlanned} from '../src/storyboard-planned.js';
const source='场景：门口\n人物：甲、乙\n△画面：甲乙站在门旁。\n👤 新人：甲\n🎙 声纹绑定：温和成年女声\n甲：你好。\n乙：请进。\n甲（OS）：稍等。';
test('explicit source hint stays with its speaker; another character remains unknown',()=>{
 const p=planScript(source);assert.deepEqual(p.entries.map(e=>e.voiceSource),['source-explicit','unknown','source-explicit']);assert.equal(p.entries[1].voiceHint,'');assert.ok(p.entries[2].voiceHint.includes('女声'));
 const prompt=plannedPrompt(p,'中性写实',[],{contentContract:5});assert.ok(prompt.includes('声线来源合同5'));assert.ok(prompt.includes('"voiceSource":"unknown"'));assert.ok(prompt.includes('"voiceHint":"🎙 声纹绑定：温和成年女声"'));
});
test('per-utterance source instructions are explicit without spreading to later speakers',()=>{
 const p=planScript('场景：门口\n△画面：两人站立。\n甲：你好。\n(配音指令：轻声)\n乙：请进。');assert.equal(p.entries[0].voiceSource,'source-explicit');assert.equal(p.entries[1].voiceSource,'unknown');assert.equal(p.entries[1].voiceHint,'');
});
test('contract5 render labels unknown voice without adopting generated gender; old v3 contract remains readable',()=>{
 const dir=new URL('../../影策审计-20261025/',import.meta.url),text=fs.readFileSync(new URL('repair-live-storyboard-v3-frozen-input.txt',dir),'utf8'),raw=parsePlannedText(JSON.parse(fs.readFileSync(new URL('repair-live-storyboard-v3-frozen-response.json',dir),'utf8')).choices[0].message.content),p=planScript(text);
 // Explicit synthetic sound correction isolates voice rendering; original raw
 // still fails new content checks and is not called a provider success.
 const corrected=structuredClone(raw);for(const s of corrected.segments){s.voiceLock='林岚成年男性低沉声';for(const shot of s.shots)shot.sound='自然风声与衣物摩擦。';}
 const rows=renderPlanned(corrected,p,{contentContract:5}).rows;assert.ok(rows[0].videoMotionPrompt.includes('音色未确认（unknown）'));assert.ok(!rows[0].videoMotionPrompt.includes('声纹沿用原剧本'));assert.ok(!rows[0].emotion.includes('成年男性'));
 assert.doesNotThrow(()=>renderPlanned(raw,p));
});
test('actual contract4b response remains rejected by strict source format rather than rewritten for voice claims',()=>{
 const file=new URL('../../影策审计-20261025/repair-live-storyboard-v3-contract4b-response.json',import.meta.url),body=JSON.parse(fs.readFileSync(file,'utf8')).choices[0].message.content;
 // Record the real current parser outcome; duplicate keys or incomplete
 // contract are rejected, not repaired by inserting a voice source.
 let raw;try{raw=parsePlannedText(body);}catch(e){assert.match(e.message,/重复|JSON|Unexpected|Expected/);return;}
 const input=fs.readFileSync(new URL('../../影策审计-20261025/repair-live-storyboard-v3-contract4b-input.txt',import.meta.url),'utf8');assert.throws(()=>renderPlanned(raw,planScript(input),{contentContract:5}));
});
