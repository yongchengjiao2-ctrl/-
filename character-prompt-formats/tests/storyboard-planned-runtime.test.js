import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{generatePlannedChapter,recoverPlannedTask}from '../src/storyboard-planned-runtime-audit-v3.js';import{planScript,packedV2PlanScript,renderPlanned}from '../src/storyboard-planned.js';
import path from 'node:path';
const dir=new URL('../build/test-six/',import.meta.url),read=n=>JSON.parse(fs.readFileSync(new URL(n,dir),'utf8')),input=read('input.json');

test('current v3 runtime accepts explicitly synthetic complete director data once and recovers identical rows',async()=>{
 const source='场景：仓库\n人物：甲\n△画面：甲站在仓库门边。\n甲：请开门。',plan=planScript(source);
 // Synthetic dependency response, not a saved provider response or live test.
 const raw={title:'合成正向样例',segments:plan.segments.map(p=>({id:p.id,visibleAssets:['甲'],assetDescriptions:[{name:'仓库',category:'environment',description:'仓库入口位于画面后方，左侧窗户投下柔和自然光。'},{name:'甲',category:'character',description:'甲站在仓库门边面向室内，双手空置并自然垂落。'}],voiceLock:'甲用自然平静的青年声对白，不使用背景音乐。',style:'现代写实电影画面，暖灰色调与真实木材质感。',rules:'保持门的位置和甲的服装姿态连续，不增加额外人物。',constraints:'避免穿模和额外字幕，不增加原文不存在的道具。',trigger:'无额外触发状态。',inherit:'甲在仓库门边站立，面朝室内，左侧自然光照亮衣袖。',spatial:'仓库门位于正后方，甲站在中心偏左，机位位于室内面向入口。',grid:Array.from({length:9},(_,i)=>'第'+i+'格仓库地面及画外空间'),audio:{bgm:'无背景音乐',bpm:'不适用',ambient:'仓库轻微自然风声',ducking:'甲对白时降低环境声',transition:'对白结束保持自然底噪'},endVisual:'甲保持站在门边并面向室内，双手空置，光源位置不变。',endAudio:'甲对白自然结束，仓库微弱自然风声持续。',firstFrame:'仓库入口处甲面向室内站立，左侧自然光照亮衣袖与地面。',shots:p.shots.map(()=>({camera:'中景固定机位位于仓库室内，焦点对准甲的面部与门框，保持入口轴线不跳轴。',lighting:'自然光从画面左侧窗户斜射，地面投影柔和，木门纹理和衣料层次清晰。',performance:'甲在门边双手空置自然垂落，视线保持看向室内，说出原文对白时嘴唇自然开合，身体重心平稳，不额外迈步或改变门的位置。',sound:'微弱自然风声和衣料摩擦声。'}))}))};
 for(let i=0;i<raw.segments.length;i++)for(let j=0;j<raw.segments[i].shots.length;j++)raw.segments[i].shots[j].sourceBeat=plan.segments[i].shots[j].part.beat;
 let count=0,request;
 const deps={prepare:async p=>({...p,metadata:{},selectedSkills:[]}),textConfig:c=>c,createTask:async r=>{request=r;count++;return{id:'synthetic-v3',status:'succeeded',resultJson:JSON.stringify({text:JSON.stringify(raw)})}},queryTask:async()=>{throw Error('final result must not poll')}};
 const result=await generatePlannedChapter({config:{model:'channel::gemini',channels:[{id:'channel',models:['gemini'],interfaceType:'a6api-chat'}]},projectId:'synthetic',chapterId:'v3',screenplayText:source,sourceText:source,assets:[],skills:[],selectedSkillIds:[]},{},deps);
 assert.equal(count,1);assert.equal(result.rows.map(r=>r.dialogue).join(''),'请开门。');assert.equal(request.input.metadata.storyboardPlanVersion,3);assert.equal(request.input.metadata.plannedContentContract,5);assert.match(request.prompt,/声线来源合同5/);assert.match(result.rows[0].emotion,/音色未确认/);assert.doesNotMatch(result.rows[0].emotion,/青年声/);
 assert.deepEqual(recoverPlannedTask({inputJson:JSON.stringify(request.input),resultJson:JSON.stringify({text:JSON.stringify(raw)})}).rows,result.rows);
});
test('current runtime rejects incomplete historical directed output after one submission, without pretending it is a valid v3 result',async()=>{
 for(let i=0;i<3;i++){
  const u=input.units[i],raw=read(`chapter-${i+1}-directed-v2.model.json`);let count=0,request;
  const deps={prepare:async p=>({...p,metadata:{},selectedSkills:[]}),textConfig:c=>c,createTask:async r=>{request=r;count++;return{id:'t',status:'succeeded',resultJson:JSON.stringify({text:JSON.stringify(raw)})}},queryTask:async()=>{throw Error('must use final task')}};
  await assert.rejects(generatePlannedChapter({config:{model:'channel::gemini',channels:[{id:'channel',models:['gemini'],interfaceType:'yingce-asset-json-chat'}]},projectId:'p',chapterId:u.id,screenplayText:planScript(u.source_text).text,sourceText:planScript(u.source_text).text,projectStyle:input.project.style_profile_json,assets:[],skills:[],selectedSkillIds:[]},{},deps),/缺少|禁止BGM|段落|数量|重复|sourceBeat/);
  assert.equal(count,1);assert.equal(request.operation,'text');assert.equal(request.input.textOptions.stream,false);
  assert.throws(()=>recoverPlannedTask({inputJson:JSON.stringify(request.input),resultJson:JSON.stringify({text:JSON.stringify(raw)})}),/缺少|禁止BGM|段落|数量|重复|sourceBeat/);
 }
});
test('planned generation propagates a provider failure without a second model call',async()=>{
 let count=0;await assert.rejects(generatePlannedChapter({config:{model:'m',channels:[{id:'test',models:['m'],interfaceType:'a6api-chat'}]},projectId:'p',chapterId:'failed',screenplayText:'场景：街头\n人物：甲\n△画面：甲站在街头。\n甲：你好。',assets:[],skills:[]},{},{prepare:async p=>({...p,metadata:{}}),textConfig:c=>c,createTask:async()=>{count++;throw Error('provider failed')},queryTask:async()=>{}}),/provider failed/);assert.equal(count,1);
});
test('all real three-chapter rows pass the installed project save converter without missing fields',()=>{
 const source=fs.readFileSync(path.join(process.env.LOCALAPPDATA,'YingceCanvas/versions/1.3.13/web/dist/assets/chapters-CeKTBaiU.js'),'utf8');
 const part=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
 const converter=new Function('H','Nt',part('function nn(','function rn(')+part('function an(','var pn=')+';return nn;')(x=>x,i=>'镜头 '+i);
 for(let i=1;i<=3;i++){
  const rows=renderPlanned(read(`chapter-${i}-packed-v2.model.json`),packedV2PlanScript(input.units[i-1].source_text)).rows,saved=converter(rows,{assets:[]});assert.equal(saved.length,rows.length);for(let j=0;j<rows.length;j++){assert.equal(saved[j].revision.dialogue,rows[j].dialogue);assert.equal(saved[j].revision.videoPrompt,rows[j].videoMotionPrompt);assert.equal(saved[j].durationMs,rows[j].durationSeconds*1000);}
 }
});
