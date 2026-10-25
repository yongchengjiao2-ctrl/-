import fs from 'node:fs';import path from 'node:path';
import {ClassicLevel} from '../character-prompt-formats/node_modules/classic-level/index.js';
import {generatePlannedChapter,recoverPlannedTask} from '../character-prompt-formats/src/storyboard-planned-runtime.js';
import {validateStoryboardRows} from '../character-prompt-formats/src/storyboard-complete.js';
import {assertSourceFidelity} from '../character-prompt-formats/src/source-script-contract.js';
const root=new URL('./',import.meta.url);const save=(n,v)=>fs.writeFileSync(new URL(n,root),typeof v==='string'?v:JSON.stringify(v,null,2));
const replay=process.argv.includes('--replay');
const storagePath=fs.readFileSync(new URL('../character-prompt-formats/build/storage-snapshot-path.txt',import.meta.url),'utf8').trim();
const db=new ClassicLevel(storagePath,{keyEncoding:'buffer',valueEncoding:'buffer'});await db.open();let stored;
for await(const[k,v]of db.iterator())if(k.toString().includes('ai_config_store')){try{stored=JSON.parse(v.subarray(1).toString(v[0]===0?'utf16le':'utf8')).state.config;}catch{}}
await db.close();const model='gemini-3.1-pro-preview',channel=stored?.channels.find(c=>c.enabled!==false&&c.models?.includes(model)&&c.apiKey);if(!channel)throw Error('No configured snapshot channel');
const protocol=channel.modelCosts?.find(c=>c.model===model)?.protocol||channel.interfaceType||'a6api-chat';
const config={...stored,model:channel.id+'::'+model,textModel:channel.id+'::'+model,channels:stored.channels.map(c=>c.id===channel.id?{...c,interfaceType:protocol}:c)};
const source='场景：废弃医院\n人物：林岚、陈墨\n△画面：场景是废弃医院，地板有旧水迹。成年维修员林岚穿灰色外套，右手拿铜钥匙站在仓库门前，成年保管员陈墨穿蓝色工作服站在门旁。\n林岚（OS）：钥匙还在。\n林岚：请把门打开。\n△画面：林岚把钥匙交到陈墨右手，陈墨接过，转身面向门锁。\n陈墨：好，我来开。\n旁白：两人准备进入仓库。';
save('repair-live-storyboard-input.txt',source);
const runtimeSource=fs.readFileSync(new URL('../character-prompt-formats/src/skill-runtime-CF8drDK4.js',import.meta.url),'utf8');
const body=runtimeSource.slice(runtimeSource.indexOf('function i('),runtimeSource.indexOf('var S,C,w,T,E,D='));
const factory=new Function('r','n',body+`;let S={shortDrama:{delivery:'linked-context',maxSkills:4,maxContextChars:32000,maxLinkedFilesPerSkill:3}};let C=/@\\[skill:([^\\]]+)\\]/g;let w=new Set(['.md','.txt','.json']);let T={skillIds:[],skillVersions:[],skillFiles:[]};return s;`)(()=>{},()=>{});
// A small real workflow reference exercises host-boundary injection without
// pretending this text request can execute Agent tools.
const skill={skillId:'audit-workflow',skillName:'审计分镜工作流',isAdded:true,versionId:'audit-v1',version:'1'};
const runtime=factory({getFile:async()=>({file:{binary:false,content:'根据原剧本逐字保留配音与实际资产。调用工具、审批和视频交付应由真正Agent宿主负责；本轮只写分镜。',file:{sha256:'synthetic-reference'}}}),listFiles:async()=>({files:[]})});
let submissions=0,lastTask,requestInput;const report={startedAt:new Date().toISOString(),model,modelCallCount:0,applicationHTTPTaskPipeline:false,productionDatabaseModified:false,skillTest:'synthetic workflow reference; real Skill Runtime',automaticRetry:false};
try{
 const result=await generatePlannedChapter({projectId:'audit-fictional',chapterId:'repair-live',sourceText:source,screenplayText:source,sourceMode:'source',config,projectStyle:{title:'现代写实插画，中性柔光'},assets:[],skills:[skill],selectedSkillIds:[skill.skillId]}, {},{
  prepare:async e=>{const p=await runtime.prepare(e);report.skillMetadata=p.metadata;save('repair-live-storyboard-prompt.txt',p.prompt);return p;},textConfig:c=>c,
  createTask:async request=>{
   requestInput=request.input;
   if(replay){const data=JSON.parse(fs.readFileSync(new URL('repair-live-storyboard-response.json',root),'utf8'));report.replayOfExistingResponse=true;report.originalProviderRequestId=data.id;lastTask={id:'audit-direct-provider',status:'succeeded',resultJson:JSON.stringify({text:data.choices?.[0]?.message?.content||''})};return lastTask;}
   submissions++;report.modelCallCount=submissions;
   const options=request.input.metadata.providerOptions[protocol]||{};const base=channel.baseUrl.replace(/\/$/,'');const endpoint=base.endsWith('/chat/completions')?base:base+'/chat/completions';
   const payload={model,messages:[{role:'system',content:request.input.config.systemPrompt},{role:'user',content:request.prompt}],...options,stream:false,max_tokens:options.max_tokens||16384};
   save('repair-live-storyboard-request.json',payload);
   const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+channel.apiKey},body:JSON.stringify(payload),signal:AbortSignal.timeout(180000)});
   report.httpStatus=res.status;const raw=await res.text();save('repair-live-storyboard-response.json',raw);if(!res.ok)throw Error('HTTP '+res.status);
   const data=JSON.parse(raw);report.usage=data.usage;report.providerRequestId=data.id;report.finishReason=data.choices?.[0]?.finish_reason;
   lastTask={id:'audit-direct-provider',status:'succeeded',resultJson:JSON.stringify({text:data.choices?.[0]?.message?.content||''})};return lastTask;
  },queryTask:async()=>{throw Error('Unexpected extra query');}
 });
 const normalized=validateStoryboardRows(result.rows,[],source);assertSourceFidelity(normalized,source);
 const recovered=recoverPlannedTask({...lastTask,inputJson:JSON.stringify(requestInput)});
 if(JSON.stringify(recovered.rows)!==JSON.stringify(result.rows))throw Error('Recovery differs from final result');
 if(!normalized.some(r=>/水迹/.test(r.videoMotionPrompt)))throw Error('Scene source fact absent from model storyboard');
 save('repair-live-storyboard-complete.json',{...result,rows:normalized});
 report.validated=true;report.rows=normalized.length;report.sourceFidelityPassed=true;report.recoveryPassed=true;report.realDatabaseWritePassed=false;
}catch(e){report.validated=false;report.error=e.message;}
report.finishedAt=new Date().toISOString();save(replay?'repair-live-storyboard-replay-report.json':'repair-live-storyboard-report.json',report);console.log(JSON.stringify(report));
