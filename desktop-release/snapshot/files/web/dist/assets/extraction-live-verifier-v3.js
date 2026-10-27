import {requestExtraction} from './asset-extraction-runtime-v3.js';
import {readSettings,annotateResult} from './character-prompt-formats-v3.js';
import {_ as configStore,x as initializeConfig} from './use-config-store-BNvhZKBV.js';
import {o as initializeClient,a as client} from './request-Dlp4yxtR.js';
initializeConfig();initializeClient();
export const report=[];
function show(){let panel=document.getElementById('extraction-verification-panel');if(!panel){panel=document.createElement('pre');panel.id='extraction-verification-panel';panel.style.cssText='position:fixed;bottom:16px;right:16px;z-index:100000;background:#fff;color:#111;padding:16px;border:2px solid #5271ff;border-radius:12px;max-width:650px;max-height:55vh;overflow:auto;box-shadow:0 5px 25px #0003;font-size:13px;white-space:pre-wrap';document.body.appendChild(panel);}panel.textContent='资产提取真实验证（保存到测试2）\n'+report.map(r=>`${r.label}：${r.state}${r.counts?' · '+JSON.stringify(r.counts):''}${r.error?' · '+r.error:''}\n任务：${r.taskId||'准备中'}`).join('\n\n');localStorage.setItem('yingce.extraction-live-verification.v3',JSON.stringify(report));}
export async function runOne(modelName,formatId){
 const input=await (await fetch('/assets/extraction-live-test-input.json')).json();
 const config=configStore.getState().config;
 const model=config.textModels.find(m=>m.includes(modelName));if(!model)throw Error('配置中没有模型 '+modelName);
 const format=readSettings().formats.find(f=>f.id===formatId);if(!format)throw Error('模板不存在');
 const row={label:modelName+' / '+formatId,state:'请求中',startedAt:new Date().toISOString()};report.push(row);show();
 try{
  const text=await requestExtraction({...input,roleFormat:format,config:{...config,model,textModel:model},testLabel:row.label},task=>{row.taskId=task.id;row.state=task.status;show()});
  const data=annotateResult(JSON.parse(text),format);
  const candidates=[...data.characters.map(x=>({unitId:input.chapterId,name:x.name,category:'character',details:{...x,verification:{label:row.label,taskId:row.taskId}}})),...data.scenes.map(x=>({unitId:input.chapterId,name:x.name,category:'environment',details:{...x,verification:{label:row.label,taskId:row.taskId}}})),...data.props.map(x=>({unitId:input.chapterId,name:x.name,category:'prop',details:{...x,verification:{label:row.label,taskId:row.taskId}}}))];
  if(!data.characters.length||!data.scenes.length||!data.props.length)throw Error('本测试剧本三类资产都非空，模型有分类漏提');
  await client.post(`/projects/${input.projectId}/asset-candidates`,{candidates,source:'chapter_character_extract'});
  const saved=await client.get(`/projects/${input.projectId}/asset-candidates`,{params:{unitId:input.chapterId,pageSize:100}});
  for(const candidate of candidates){if(!saved.candidates.some(x=>x.name===candidate.name&&x.category===candidate.category&&JSON.parse(x.detailsJson||'{}').verification?.taskId===row.taskId))throw Error('资产保存核对未通过：'+candidate.name)}
  row.state='完整返回，解析通过，已保存并回读核对';row.counts={characters:data.characters.length,scenes:data.scenes.length,props:data.props.length};row.finishedAt=new Date().toISOString();show();return row;
 }catch(error){row.state='失败';row.error=error.message;show();throw error;}
}
