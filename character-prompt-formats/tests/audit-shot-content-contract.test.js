import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
import {planScript,renderPlanned,assertPlannedShotContent,plannedPrompt,plannedResponseFormat} from '../src/storyboard-planned.js';
const evidence=new URL('../../影策审计-20261025/',import.meta.url),source=fs.readFileSync(new URL('repair-live-storyboard-v3-frozen-input.txt',evidence),'utf8'),response=JSON.parse(fs.readFileSync(new URL('repair-live-storyboard-v3-frozen-response.json',evidence),'utf8'));
const raw=JSON.parse(response.choices[0].message.content.trim().replace(/^```json\s*/,'').replace(/\s*```$/,'')),plan=planScript(source);

test('contract4 requires per-shot integer exact source beat, while old version3 playback remains readable',()=>{
 assert.doesNotThrow(()=>renderPlanned(raw,plan));
 const missing=structuredClone(raw);delete missing.segments[0].shots[0].sourceBeat;
 assert.throws(()=>renderPlanned(missing,plan,{contentContract:4}),/sourceBeat/);
 for(const value of [undefined,'1',1.5,0,2])assert.throws(()=>assertPlannedShotContent({sourceBeat:value,sound:'环境自然风声'},{part:{beat:1}}),/sourceBeat/);
 assert.doesNotThrow(()=>assertPlannedShotContent({sourceBeat:1,sound:'环境自然风声'},{part:{beat:1}}));
});

test('contract4 rejects actual saved linguistic sound contamination and does not sanitize it into fake success',()=>{
 assert.throws(()=>renderPlanned(raw,plan,{contentContract:4}),/sound包含语言/);
 for(const sound of ['旁白沉稳回响','陈墨对白声和金属碰撞','林岚说话声','台词声','人声发言','无对白，但旁白继续','无旁白，但有对白声'])assert.throws(()=>assertPlannedShotContent({sourceBeat:1,sound},{part:{beat:1}}),/语言声音/);
 for(const sound of ['无对白，无旁白，只有自然风声。','不含人声，保留金属碰撞声。','没有任何台词声，只有脚步与衣料声。'])assert.doesNotThrow(()=>assertPlannedShotContent({sourceBeat:1,sound},{part:{beat:1}}));
});

test('new prompt/schema label each source visual and boundary; strict renderer preserves source provenance',()=>{
 const old=plannedResponseFormat(1).json_schema.schema.properties.segments.items.properties.shots.items;
 const strict=plannedResponseFormat(1,{contentContract:4}).json_schema.schema.properties.segments.items.properties.shots.items;
 assert.ok(!old.required.includes('sourceBeat'));assert.ok(strict.required.includes('sourceBeat'));
 const prompt=plannedPrompt(plan,'现代写实插画',[],{contentContract:4});assert.ok(prompt.includes('强制导演内容合同4'));assert.ok(prompt.includes('sourceVisual'));assert.ok(prompt.includes('不得将后镜动作提前执行'));
 // A synthetic local sound-only correction tests the new gate, not actual
 // supplier quality. It does not make the repeated-action raw sample valid.
 const corrected=structuredClone(raw);for(const segment of corrected.segments)for(const shot of segment.shots)shot.sound='自然环境风声与衣料摩擦。';
 const rows=renderPlanned(corrected,plan,{contentContract:4}).rows;
 assert.ok(rows[0].videoMotionPrompt.includes('本镜来源原画面1：'));
 assert.ok(rows[0].videoMotionPrompt.includes('本镜来源原画面2：'));
});
