import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{planScript,packedV2PlanScript,renderPlanned}from '../src/storyboard-planned.js';import{auditDetailed}from '../src/storyboard-detail-contract.js';
const input=JSON.parse(fs.readFileSync(new URL('../build/test-six/input.json',import.meta.url),'utf8'));
test('three actual chapters have locked contiguous timing, all source beats and full speech without speaker instructions',()=>{
 for(const unit of input.units){const p=planScript(unit.source_text);assert.ok(p.voice.length>300);assert.ok(p.segments.length>=6&&p.segments.length<=20);assert.equal(new Set(p.segments.flatMap(s=>s.sourceBeats)).size,p.beats);assert.equal(p.segments.map(s=>s.voice).join(''),p.voice);for(const s of p.segments){assert.ok(s.duration<=15);assert.ok(s.shots.length>=1);for(const t of s.shots)assert.ok(t.duration>=2&&t.duration<=5);assert.equal(s.shots.map(s=>s.voice).join(''),s.voice);for(const t of s.shots)assert.ok(t.voice.replace(/\s/g,'').length/t.duration<=4.01);}}
});
test('renderer owns time and speech; model may not omit the planned number of slots',()=>{
 const plan=planScript('场景：街道\n人物：甲\n△画面：甲在街道持伞站立。\n甲（站在街道）：今天阳光明媚，我们一起回家。');assert.throws(()=>renderPlanned({segments:[]},plan),/遗漏/);
 const d={title:'分镜',segments:plan.segments.map(p=>({id:p.id,visibleAssets:['甲','雨伞'],voiceLock:'甲以沉稳青年男声说话，语气自然平缓。',style:'日间自然暖光与写实材质电影画面。',rules:'人物站位衣服和雨伞持物手保持连续。',constraints:'不要出现额外字幕和现代界面水印。',trigger:'无额外触发状态。',inherit:'甲在街道中央面向前方，右手持雨伞。',spatial:'甲位于街道中央前景，右手持伞面向前方，机位位于街道正后方。',grid:Array.from({length:9},(_,i)=>'第'+i+'格街道地面与画外空间'),audio:{bgm:'无',bpm:'不适用',ambient:'街道自然风声',ducking:'对白时环境声压低3dB',transition:'自然延续至下一段'},endVisual:'甲在街道中央面向前方，右手持伞保持站立。',endAudio:'对白自然结束，街道自然风声保持延续。',firstFrame:'日间街道中央，甲右手持伞站立。',shots:[{camera:'中景固定机位，摄影机位于甲正前方，焦点锁定人物面部和持物手。',lighting:'自然光自画面左侧落下，地面投影柔和，微风轻拂伞面。',performance:'甲保持站立，右手持伞，目光看向摄影机前方，左手自然垂落。',sound:'轻微自然风声与衣料摩擦声同步。'}]}))};
 for(let i=0;i<d.segments.length;i++){
  const item=d.segments[i];item.assetDescriptions=[{name:'街道',category:'environment',description:'日间街道沿纵深延伸，阳光从左侧照射地面。'},{name:'甲',category:'character',description:'甲站在街道中央面向前方，目光平静，右手持伞。'},{name:'雨伞',category:'prop',description:'雨伞由甲右手握持，伞面在头顶展开遮住阳光。'}];item.shots=plan.segments[i].shots.map(()=>({...item.shots[0],performance:item.shots[0].performance+'嘴唇随本人对白自然开合，视线落在前方，下镜衔接保持同一持伞手。'}));
 }
 const result=renderPlanned(d,plan);assert.equal(result.rows[0].dialogue,plan.voice);assert.deepEqual(auditDetailed(result.rows[0],{requireCopy:true}),[]);
 const noMusic=structuredClone(d);for(const item of noMusic.segments)item.audio.bgm='无背景音乐';assert.doesNotThrow(()=>renderPlanned(noMusic,plan));
 for(const value of ['无背景音乐但加入钢琴伴奏','舒缓背景音乐','有节奏的环境配乐']){const bad=structuredClone(d);for(const item of bad.segments)item.audio.bgm=value;assert.throws(()=>renderPlanned(bad,plan),/禁止BGM/);}
});
import {bindPrompt} from '../src/shot-asset-bindings.js';import {normalizeDetailedRows} from '../src/storyboard-detail-normalize.js';
test('packed rows retain asset descriptions and @ through empty asset save; timing reaches segment end',()=>{
 for(let i=0;i<3;i++){
  const p=packedV2PlanScript(input.units[i].source_text),raw=JSON.parse(fs.readFileSync(new URL(`../build/test-six/chapter-${i+1}-packed-v2.model.json`,import.meta.url))),rows=renderPlanned(raw,p).rows;
  for(let j=0;j<rows.length;j++){
   const s=p.segments[j];assert.equal(s.parts[0].start,0);assert.equal(s.parts.at(-1).end,s.duration);for(let k=1;k<s.parts.length;k++)assert.equal(s.parts[k].start,s.parts[k-1].end);
   for(const prompt of [bindPrompt(rows[j].videoMotionPrompt,[]),normalizeDetailedRows([rows[j]],[])[0].videoMotionPrompt]){assert.ok(prompt.includes('【本段人物、场景与道具】'));for(const ref of rows[j].referenceInfo)assert.ok(prompt.includes('@'+ref.name));}
  }
 }
});
