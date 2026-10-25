import fs from 'node:fs';
import {ClassicLevel} from '../character-prompt-formats/node_modules/classic-level/index.js';
import {loadManagedFormats,buildExtractionPrompt,annotateResult} from '../character-prompt-formats/src/character-prompt-formats.js';
import {parseExtractionJSON} from '../character-prompt-formats/src/extraction-recovery.js';
import {assertSourceCoverage,assertNamedPeopleSeparate,assertFormatCompleteness} from '../character-prompt-formats/src/extraction-completeness-v4.js';
const storage=fs.readFileSync(new URL('../character-prompt-formats/build/storage-snapshot-path.txt',import.meta.url),'utf8').trim();
const db=new ClassicLevel(storage,{keyEncoding:'buffer',valueEncoding:'buffer'});await db.open();let config;
for await(const[k,v] of db.iterator())if(k.toString('utf8').includes('ai_config_store')){try{config=JSON.parse(v.subarray(1).toString(v[0]===0?'utf16le':'utf8')).state.config;}catch{}}
await db.close();if(!config)throw Error('No saved config snapshot');
const catalog=JSON.parse(fs.readFileSync(new URL('./deep-inventory.json',import.meta.url),'utf8')).templates;
const formats=await loadManagedFormats(()=>catalog);
const variables={'项目名称':'审计虚构样例','项目画风':'现代写实插画，中性柔光。人物姓名与情节均为虚构。','章节标题':'钥匙','章节正文':'场景：仓库\n人物：林岚、陈墨\n△画面：林岚是一名穿灰色外套的成年女维修员，陈墨是一名穿蓝色工作服的成年男保管员。两人站在仓库内，林岚从木桌上拿起一把铜钥匙递给陈墨。\n旁白：林岚把钥匙交给陈墨。'};
fs.writeFileSync(new URL('./synthetic-input.json',import.meta.url),JSON.stringify(variables,null,2));
await Promise.all([['deepseek-v4-pro-0813','side-portrait'],['gemini-3.1-pro-preview','four-panel']].map(async([model,id])=>{
 const report={model,format:id,configurationSource:'existing localStorage snapshot; not proof of current UI selection',startedAt:new Date().toISOString(),applicationTaskPipeline:false,automaticRetry:false};
 const prefix=new URL('./synthetic-'+id,import.meta.url);
 try{
 const channel=config.channels.find(c=>c.enabled!==false&&c.models?.includes(model)&&c.apiKey);
 if(!channel)throw Error('No enabled configured model channel in saved snapshot');
 const format=formats.find(f=>f.id===id);const prompt=buildExtractionPrompt(variables,format);
 fs.writeFileSync(new URL(prefix.href+'.prompt.txt'),prompt);
 let base=channel.baseUrl.replace(/\/$/,'');let endpoint=base.endsWith('/chat/completions')?base:base+'/chat/completions';
 console.log('START',model,id);
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+channel.apiKey},body:JSON.stringify({model,messages:[{role:'system',content:'你是资产提取器，只返回完整有效的JSON对象。'},{role:'user',content:prompt}],stream:false,response_format:{type:'json_object'},max_tokens:65536,...model.includes('deepseek')?{thinking:{type:'disabled'}}:{}}),signal:AbortSignal.timeout(240000)});
 report.httpStatus=response.status;report.contentType=response.headers.get('content-type');
 const raw=await response.text();fs.writeFileSync(new URL(prefix.href+'.response.json'),raw);
 if(!response.ok)throw Error('HTTP '+response.status);
 const body=JSON.parse(raw);report.finishReason=body.choices?.[0]?.finish_reason;report.usage=body.usage;
 const content=body.choices?.[0]?.message?.content;report.contentChars=content?.length||0;
 const assets=parseExtractionJSON(content||'');assertNamedPeopleSeparate(assets,variables);assertSourceCoverage(assets,variables);assertFormatCompleteness(assets,format);
 report.counts=Object.fromEntries(['characters','scenes','props'].map(k=>[k,assets[k].length]));
 report.names=Object.fromEntries(['characters','scenes','props'].map(k=>[k,assets[k].map(a=>a.name)]));
 fs.writeFileSync(new URL(prefix.href+'.assets.json'),JSON.stringify(annotateResult(assets,format),null,2));
 report.validated=true;
 }catch(e){report.validated=false;report.error=e.message;}
 report.finishedAt=new Date().toISOString();fs.writeFileSync(new URL(prefix.href+'.report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}));
