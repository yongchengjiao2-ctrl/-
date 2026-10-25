import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
import {parsePlannedText,planScript,packedV2PlanScript,renderPlanned,assertPlannedAxisTransition,plannedPrompt} from '../src/storyboard-planned.js';
const evidence=new URL('../../影策审计-20261025/',import.meta.url);
const source=fs.readFileSync(new URL('repair-live-storyboard-input.txt',evidence),'utf8');
const response=JSON.parse(fs.readFileSync(new URL('repair-live-storyboard-response.json',evidence),'utf8'));
const actual=JSON.parse(response.choices[0].message.content);

test('actual saved supplier response with an unexplained reverse axis is rejected without changing evidence',()=>{
 assert.match(actual.segments[0].shots[2].camera,/反轴/);
 assert.throws(()=>renderPlanned(actual,planScript(source)),/缺少可见.*过渡/);
});

test('finite axis gate permits a visible neutral or continuous orbit transition and rejects vague or negated transitions',()=>{
 for(const camera of ['反轴拍摄，保持连续。','越轴拍摄，无中性正轴镜头过渡。','换轴拍摄，禁止摄影机连续绕轴运动过渡。'])assert.throws(()=>assertPlannedAxisTransition(camera),/过渡/);
 for(const camera of ['不越轴，维持同侧机位。','反轴拍摄，先用中性正轴镜头过渡，再切至另一侧。','摄影机连续绕轴运动从左侧移至右侧，完成换轴过渡。'])assert.doesNotThrow(()=>assertPlannedAxisTransition(camera));
});

test('synthetic transition correction preserves OS and named dialogue mode regardless of over-shoulder wording',()=>{
 // This is a synthetic local correction, not a new successful supplier sample.
 const corrected=structuredClone(actual),plan=planScript(source);
 corrected.segments[0].shots[2].camera+='先用中性正轴镜头过渡，再切至陈墨后方过肩机位，保持空间关系可辨。';
 const rendered=renderPlanned(corrected,plan),main=rendered.rows[0].videoMotionPrompt;
 assert.ok(main.includes('林岚（画外音）：钥匙还在。'));
 assert.ok(main.includes('林岚（对白）：请把门打开。'));
 assert.ok(main.includes('陈墨（对白）：好，我来开。'));
 assert.ok(!main.includes('陈墨（画外音）：好，我来开。'));
 const prompt=plannedPrompt(plan,'现代写实插画',[]);assert.ok(prompt.includes('原文只有陈墨转身时'));assert.ok(prompt.includes('不得新增原文没有的主体动作'));
});

test('axis gate remains limited to version3, preserving historical packed-v2 playback',()=>{
 const dir=new URL('../build/test-six/',import.meta.url),input=JSON.parse(fs.readFileSync(new URL('input.json',dir),'utf8'));
 for(let i=0;i<3;i++){const plan=packedV2PlanScript(input.units[i].source_text),raw=JSON.parse(fs.readFileSync(new URL(`chapter-${i+1}-packed-v2.model.json`,dir),'utf8'));assert.doesNotThrow(()=>renderPlanned(raw,plan));}
});

test('contract4 explicit same-axis left/right switches survive ambiguous inside shots but require visible transition',()=>{
 const state={side:null,visibleTransition:false};
 assertPlannedAxisTransition('中景机位；正轴线右侧；人物站在画面左侧。','',state);
 assertPlannedAxisTransition('近景机位；正轴线内侧；人物身体朝向右侧。','',state);
 assert.equal(state.side,'右');
 assert.throws(()=>assertPlannedAxisTransition('越肩机位；正轴线左侧；对焦陈墨。','',state),/左右换侧/);
 assertPlannedAxisTransition('正轴线左侧；先用中性正轴镜头过渡，再切过肩机位。','',state);assert.equal(state.side,'左');
 const characterSides={side:null};assertPlannedAxisTransition('摄影机位于林岚右侧，陈墨位于画面左侧。','',characterSides);assertPlannedAxisTransition('摄影机位于陈墨左侧，林岚身体朝右侧。','',characterSides);assert.equal(characterSides.side,null);
});

test('saved contract4 supplier response is rejected for explicit axis-side flip without editing its raw evidence',()=>{
 const file=new URL('repair-live-storyboard-v3-contract4-response.json',evidence);
 const raw=JSON.parse(JSON.parse(fs.readFileSync(file,'utf8')).choices[0].message.content.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));
 assert.throws(()=>renderPlanned(raw,planScript(source),{contentContract:4}),/左右换侧/);
});

test('new strict parser rejects duplicate keys in saved contract4 provider text before lossy JSON.parse',()=>{
 const body=JSON.parse(fs.readFileSync(new URL('repair-live-storyboard-v3-contract4-response.json',evidence),'utf8')).choices[0].message.content;
 assert.throws(()=>parsePlannedText(body),/重复/);
 const prompt=plannedPrompt(planScript(source),'现代写实',[],{contentContract:4});assert.ok(prompt.includes('同一对象字段只出现一次'));assert.ok(prompt.includes('静止无足部动作不得添脚步声'));
});
