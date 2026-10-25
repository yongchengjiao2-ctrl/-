import{assertNamedPeopleSeparate,assertSourceCoverage,assertFormatCompleteness,coverageRules}from './extraction-completeness-v4.js';

import {o as generate,n as initializeGeneration} from './generation-task-B2p8YPAC.js';

import {normalizeTextConfig,buildExtractionPrompt} from './character-prompt-formats.js';

import {parseExtractionJSON} from './extraction-contract-v3.js';

import {o as parseCharacters,i as initializeCharacters} from './character-parser-v3.js';

export function validateAssets(text){
 initializeCharacters();
const data=parseExtractionJSON(text);

 for(const character of data.characters){
  if(!character||typeof character!=='object'||Array.isArray(character))throw Error('characters每项必须为对象');

  if(!Array.isArray(character.aliases)||!character.aliases.every(x=>typeof x==='string'))throw Error('角色aliases必须为字符串数组');

  for(const field of ['name','role','appearance','physique','clothing','personality','props','consistencyPrompt','multiViewPrompt','voiceLanguage','voiceAge','voiceTimbre'])if(typeof character[field]!=='string')throw Error(`角色${character.name||''}.${field}必须为字符串`);

 }
 const characters=data.characters.length?parseCharacters(JSON.stringify(data)):[];

 for(const key of ['scenes','props'])for(const item of data[key])for(const field of ['name','description','prompt'])if(typeof item?.[field]!=='string'||!item[field].trim())throw Error(`${key}.${field}必须为非空字符串`);

 return {...data,characters};

}
export async function requestExtraction(e,onTaskCreated){
 initializeGeneration();
const model=e.config.textModel||e.config.model;

 const normalized=normalizeTextConfig({...e.config,model,textModel:model},model);

 const channelId=model.includes('::')?model.split('::')[0]:null;

 const plainModel=model.split('::').at(-1);

 const protocol='yingce-asset-json-chat';

 const config={...normalized,channels:normalized.channels.map(c=>(channelId?c.id===channelId:c.models?.includes(plainModel))?{...c,interfaceType:protocol,modelCosts:[...(c.modelCosts||[]).filter(x=>x.model!==plainModel),{...(c.modelCosts||[]).find(x=>x.model===plainModel),model:plainModel,protocol,defaultOptions:{...model.includes('deepseek')?{thinking:{type:'disabled'}}:{},max_tokens:65536,stream:false,response_format:{type:'json_object'}}}]}:c)};

 const prompt=buildExtractionPrompt(e.variables,e.roleFormat)+coverageRules(e.variables);

 let failure='';

 for(let attempt=0;
attempt<2;
attempt++){
  const result=await generate({projectId:e.projectId,mode:'text',streamText:false,enableThinking:false,config,prompt:prompt+(attempt?`\n【完整重新生成】上次返回未通过校验：${failure}。重新输出完整JSON对象，必须同时包含characters、scenes、props数组。不要续传，不要漏掉任何分类，不得为了通过校验而将正文已有资产返回空数组。`:'') ,metadata:{domainProjectId:e.projectId,chapterId:e.chapterId,nodeId:`chapter_character_breakdown:${e.chapterId}`,operation:'chapter_character_breakdown',responseMode:'non-stream',requestedStream:false,validationAttempt:attempt,extractionContractVersion:3,providerOptions:{[protocol]:{...model.includes('deepseek')?{thinking:{type:'disabled'}}:{},stream:false,response_format:{type:'json_object'},max_tokens:65536}},promptTemplateVariables:e.variables,characterPromptFormat:e.roleFormat,...e.testLabel?{verificationLabel:e.testLabel}:{}},onTaskUpdate:onTaskCreated});

  try{const data=validateAssets(result.text||'');
assertNamedPeopleSeparate(data,e.variables);
assertSourceCoverage(data,e.variables);
assertFormatCompleteness(data,e.roleFormat);
return JSON.stringify(data);
}catch(error){failure=error.message;
if(attempt===1)throw Error(`资产结果连续校验失败：${failure}`);
}
 }
}
