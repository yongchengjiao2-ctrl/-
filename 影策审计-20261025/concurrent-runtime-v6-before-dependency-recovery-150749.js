import {textRequestPolicy} from './text-request-policy.js';
import {buildExtractionContractPrompt} from './extraction-contract-builder.js';
import {SOURCE_INVENTORY_RULES,validateSourceInventory,validateVisualProvenance} from './extraction-source-inventory.js';
import {IDENTITY_RULES as RFIdentityRules,identityCatalog as RFIdentityCatalog,preserveIdentity as RFPreserveIdentity,assertIdentityFields as RFAssertIdentity,stampSourceTask as RFStampTask,normalizeIdentityFields as RFNormalizeIdentity} from './asset-provenance.js';
import{assertNamedPeopleSeparate,assertSourceCoverage,assertFormatCompleteness,coverageRules}from './extraction-completeness-v4.js?coverage-final-6';
import {o as generate,n as initializeGeneration} from './generation-task-B2p8YPAC.js';
import {normalizeTextConfig,buildExtractionPrompt,annotateResult} from './character-prompt-formats.js?managed-layout-v5';
import {parseExtractionJSON} from './extraction-contract-v3.js';
import {o as parseCharacters,i as initializeCharacters} from './character-parser-v3.js';
export function validateAssets(text){
 initializeCharacters();const data=parseExtractionJSON(text);
 for(const character of data.characters){
  if(!character||typeof character!=='object'||Array.isArray(character))throw Error('characters每项必须为对象');
  if(!Array.isArray(character.aliases)||!character.aliases.every(x=>typeof x==='string'))throw Error('角色aliases必须为字符串数组');
  for(const field of ['name','role','appearance','physique','clothing','personality','props','consistencyPrompt','multiViewPrompt','voiceLanguage','voiceAge','voiceTimbre'])if(typeof character[field]!=='string'||(field!=='props'&&!character[field].trim()))throw Error(`角色${character.name||''}.${field}必须为非空字符串`);
 }
 const characters=data.characters.length?RFPreserveIdentity(parseCharacters(JSON.stringify(data)),data.characters).map(character=>{
  // The compiled parser intentionally retains only its legacy fields. Match the
  // main name, never aliases, before restoring v6 provenance from the raw item.
  const key=value=>String(value??'').normalize('NFKC').trim();
  const raw=data.characters.find(item=>key(item.name)===key(character.name));
  return raw?.visualProvenance?{...character,visualProvenance:raw.visualProvenance}:character;
 }):[];
 for(const key of ['scenes','props'])for(const item of data[key])for(const field of ['name','description','prompt'])if(typeof item?.[field]!=='string'||!item[field].trim())throw Error(`${key}.${field}必须为非空字符串`);
 return {...data,characters};
}
export async function requestExtraction(e,onTaskCreated){
 initializeGeneration();const model=e.config.textModel||e.config.model;
 const normalized=normalizeTextConfig({...e.config,model,textModel:model},model);
 const policy=textRequestPolicy(normalized);const config=policy.config;
 const knownIdentities=await RFIdentityCatalog(e.projectId);
 const prompt=buildExtractionContractPrompt({variables:e.variables,format:e.roleFormat,identityRules:RFIdentityRules,knownIdentities,coverage:coverageRules(e.variables),compact:(model.includes('deepseek')||e.roleFormat?.id==='original')?COMPACT_TRANSPORT_RULES:''});
 const submissionId=globalThis.crypto?.randomUUID?.()||`extract-${Date.now()}-${Math.random()}`;
 let failure='',sourceTaskId='';
 for(let attempt=0;attempt<2;attempt++){
  if(e.signal?.aborted)throw new DOMException('Aborted','AbortError');
  const result=await generate({projectId:e.projectId,mode:'text',streamText:false,enableThinking:false,config,prompt:prompt+(attempt?`\n【完整重新生成】上次返回未通过校验：${failure}。重新输出完整JSON对象，必须同时包含characters、scenes、props、sourceInventory数组及各资产visualProvenance。不要续传，不要漏掉任何分类，不得为了通过校验而将正文已有资产返回空数组。`:'') ,metadata:{domainProjectId:e.projectId,chapterId:e.chapterId,nodeId:`chapter_character_breakdown:${e.chapterId}`,operation:'chapter_character_breakdown',responseMode:'non-stream',requestedStream:false,validationAttempt:attempt,maximumModelCalls:2,automaticValidationRetry:true,extractionSubmissionId:submissionId,extractionContractVersion:6,providerOptions:policy.providerOptions,textRequestPolicy:policy.diagnostic,promptTemplateVariables:e.variables,characterPromptFormat:e.roleFormat,...e.testLabel?{verificationLabel:e.testLabel}:{}},onTaskUpdate:task=>{if(task?.id)sourceTaskId=task.id;onTaskCreated?.(task);}});
  try{const data=RFNormalizeIdentity(annotateResult(validateAssets(result.text||''),e.roleFormat));RFAssertIdentity(data);assertNamedPeopleSeparate(data,e.variables);data.coverageAssessment=assertSourceCoverage(data,e.variables);assertFormatCompleteness(data,e.roleFormat);data.coverageAssessment={...data.coverageAssessment,sourceInventory:validateSourceInventory(data,e.variables),visualProvenance:validateVisualProvenance(data)};return JSON.stringify(RFStampTask(data,sourceTaskId));}catch(error){failure=error.message;if(attempt===1)throw Error(`资产结果连续校验失败：${failure}`);}
 }
}

export function validateRecoveredExtraction(text,metadata={}){
 const data=RFNormalizeIdentity(annotateResult(validateAssets(text),metadata.characterPromptFormat));
 if(metadata.extractionContractVersion>=5)RFAssertIdentity(data);
 if(metadata.extractionContractVersion>=4){
  assertNamedPeopleSeparate(data,metadata.promptTemplateVariables);
  data.coverageAssessment=assertSourceCoverage(data,metadata.promptTemplateVariables);
  assertFormatCompleteness(data,metadata.characterPromptFormat);
 }
 if(metadata.extractionContractVersion>=6)data.coverageAssessment={...data.coverageAssessment,sourceInventory:validateSourceInventory(data,metadata.promptTemplateVariables,{contractVersion:metadata.extractionContractVersion}),visualProvenance:validateVisualProvenance(data,{contractVersion:metadata.extractionContractVersion})};
 return RFStampTask(data,metadata.extractionTaskId);
}

export const COMPACT_TRANSPORT_RULES=`\n【完整优先的紧凑传输】必须先列全角色、场景、道具，再按三数组一次输出完整JSON。正文事实、所有必填字段、版式章节及人物声音字段不能省略。每字段只表达自身信息，appearance、clothing、physique、personality、consistencyPrompt不逐字重复multiViewPrompt。appearance和clothing仍逐项覆盖模板要求的五官与服装结构，使用紧凑分号短语。四联/双联的multiViewPrompt第1至21节每节用5至15个汉字的具体设定，保留完整编号标题，避免修辞和重复画质描述；第0节保留项目画风。五维multiViewPrompt保留人物独有形象与完整编号设定，不重复固定排版文字；应用从本次管理员模板快照追加【人物排版】原文。场景和道具提示词每项用完整但简洁的结构性短语覆盖模板细节。JSON外无文字，字符串换行必须转义。不能通过合并不同身份、合并不同空间、漏道具或返回空数组缩短输出。`;
