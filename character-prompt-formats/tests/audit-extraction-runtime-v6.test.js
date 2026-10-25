import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseExtractionJSON} from '../src/extraction-recovery.js';
import {preserveIdentity,assertIdentityFields,stampSourceTask,normalizeIdentityFields} from '../src/asset-provenance.js';
import {assertNamedPeopleSeparate,assertSourceCoverage,assertFormatCompleteness,coverageRules} from '../src/extraction-completeness-v4.js';
import {annotateResult,DEFAULT_FORMATS} from '../src/character-prompt-formats.js';
import {SOURCE_INVENTORY_RULES,validateSourceInventory,validateVisualProvenance,validateScenePromptSections} from '../src/extraction-source-inventory.js';
import {restoreSectionSidecars} from '../src/extraction-section-provenance.js';
const source=fs.readFileSync(new URL('../src/asset-extraction-runtime-v3.js',import.meta.url),'utf8');
const functions=source.slice(source.indexOf('export function validateAssets('),source.indexOf('export const COMPACT_TRANSPORT_RULES=')).replaceAll('export ','');
const variables={'章节正文':'人物：林岚\n场景：仓库\n道具：木桌\n林岚走进仓库，看向木桌。'};
const row=(kind,name)=>({kind,name,quote:name,occurrence:1,assetName:name,disposition:'asset',reason:'原文出现'});
const provenance=()=>({sourceFacts:['正文出现'],suggestions:['中性柔光']});
function rawSample(){return {characters:[{name:' 林岚 ',identityName:'林岚',entityType:'character',variantName:'',aliases:[],role:'维修员',appearance:'成年女性',physique:'正文未明确',clothing:'灰外套',personality:'正文未明确',props:'无携带',consistencyPrompt:'林岚灰外套',multiViewPrompt:'【造型建议】中性柔光',voiceLanguage:'普通话',voiceAge:'成年',voiceTimbre:'建议自然',visualProvenance:provenance()}],scenes:[{name:'仓库',identityName:'仓库',entityType:'environment',variantName:'',description:'仓库空间',prompt:'【视觉补全建议】中性柔光',visualProvenance:provenance()}],props:[{name:'木桌',identityName:'木桌',entityType:'prop',variantName:'',description:'木制桌子',prompt:'【视觉补全建议】中性柔光',visualProvenance:provenance()}],sourceInventory:[row('character','林岚'),row('environment','仓库'),row('prop','木桌')]};}
function sample(){const data=rawSample();data.scenes[0].prompt=['0','1','2','3','3.5','4','5','6','7','8','9','10'].map(n=>'['+n+'.设定]【视觉补全建议】中性柔光').join('\n');return data;}
function runtime(generate=async()=>{throw Error('unexpected supplier request');}){
 // Use actual runtime function bodies with an app-parser mock that intentionally
 // drops new fields, reproducing the installed parser boundary without imports.
 const parseCharacters=text=>JSON.parse(text).characters.map(({identityName,entityType,variantName,visualProvenance,...c})=>({...c,name:c.name.trim()}));
 return new Function('initializeCharacters','parseExtractionJSON','RFPreserveIdentity','parseCharacters','initializeGeneration','normalizeTextConfig','textRequestPolicy','RFIdentityCatalog','RFIdentityRules','buildExtractionPrompt','coverageRules','COMPACT_TRANSPORT_RULES','SOURCE_INVENTORY_RULES','generate','annotateResult','RFAssertIdentity','assertNamedPeopleSeparate','assertSourceCoverage','assertFormatCompleteness','validateSourceInventory','validateVisualProvenance','RFStampTask','buildExtractionContractPrompt','validateScenePromptSections','RFNormalizeIdentity','restoreSectionSidecars',functions+';return {validateAssets,requestExtraction,validateRecoveredExtraction};')(()=>{},parseExtractionJSON,preserveIdentity,parseCharacters,()=>{},c=>c,c=>({config:c,providerOptions:{},diagnostic:{protocol:'mock'}}),async()=>[],'identity rules',()=> 'template rules',coverageRules,'compact rules',SOURCE_INVENTORY_RULES,generate,annotateResult,assertIdentityFields,assertNamedPeopleSeparate,assertSourceCoverage,assertFormatCompleteness,validateSourceInventory,validateVisualProvenance,stampSourceTask,()=>SOURCE_INVENTORY_RULES,validateScenePromptSections,normalizeIdentityFields,restoreSectionSidecars);
}
test('actual validateAssets preserves visual provenance and existing identity metadata after parser drops fields',()=>{
 const data=runtime().validateAssets(JSON.stringify(sample()));
 assert.equal(data.characters[0].name,'林岚');assert.equal(data.characters[0].identityName,'林岚');assert.deepEqual(data.characters[0].visualProvenance,provenance());
});
test('actual v6 recovery requires inventory and real source spans, rejects missing generated props',()=>{
 const api=runtime(),metadata={extractionContractVersion:6,promptTemplateVariables:variables,extractionTaskId:'task-real'};
 const good=api.validateRecoveredExtraction(JSON.stringify(sample()),metadata);
 assert.equal(good.coverageAssessment.sourceInventory.status,'self-inventory-linked');assert.equal(good.coverageAssessment.visualProvenance.status,'provenance-declared');
 assert.equal(good.characters[0].extractionSourceTaskId,'task-real');
 const missing=sample();delete missing.sourceInventory;assert.throws(()=>api.validateRecoveredExtraction(JSON.stringify(missing),metadata),/要求顶层sourceInventory/);
 const forged=sample();forged.sourceInventory[0].quote='不存在于原文的句子';assert.throws(()=>api.validateRecoveredExtraction(JSON.stringify(forged),metadata),/不属于本次正文/);
 const noProp=sample();noProp.props=[];assert.throws(()=>api.validateRecoveredExtraction(JSON.stringify(noProp),{...metadata,promptTemplateVariables:{'章节正文':'林岚在仓库里看木桌。'}}),/未映射至props实际资产/);
});
test('actual v5 recovery keeps compatibility without inventory or visual provenance',()=>{
 const old=sample();delete old.sourceInventory;for(const key of ['characters','scenes','props'])for(const a of old[key])delete a.visualProvenance;
 const result=runtime().validateRecoveredExtraction(JSON.stringify(old),{extractionContractVersion:5,promptTemplateVariables:variables});
 assert.equal(result.characters[0].name,'林岚');assert.equal(result.coverageAssessment.sourceInventory,undefined);
});
test('actual v6 request adds contract once, keeps policy metadata and stamps one valid generated task',async()=>{
 const calls=[];const api=runtime(async request=>{calls.push(request);request.onTaskUpdate({id:'supplier-task-1'});return {text:JSON.stringify(sample())};});
 const result=JSON.parse(await api.requestExtraction({config:{model:'mock'},variables,roleFormat:null,projectId:'p',chapterId:'u'}));
 assert.equal(calls.length,1);assert.equal(calls[0].metadata.extractionContractVersion,6);assert.equal(calls[0].metadata.maximumModelCalls,2);assert.match(calls[0].prompt,/来源清单合同 v6/);assert.equal(result.characters[0].extractionSourceTaskId,'supplier-task-1');assert.equal(result.coverageAssessment.requiresHumanReview,true);
});
test('actual v6 request never saves invalid inventory and keeps the two-call content retry bound',async()=>{
 const bad=sample();delete bad.sourceInventory;let calls=0;
 const api=runtime(async()=>{calls++;return {text:JSON.stringify(bad)};});
 await assert.rejects(api.requestExtraction({config:{model:'mock'},variables,roleFormat:null,projectId:'p',chapterId:'u'}),/连续校验失败.*sourceInventory/);assert.equal(calls,2);
});
test('host-appended fixed layout cannot supply a missing visual suggestion label in character-specific sections',()=>{
 const data=sample();data.characters[0].multiViewPrompt='[0.画面要求]现代写实\n[1.基础档案]林岚\n[22.摄影排版指令]造型建议';
 assert.throws(()=>validateVisualProvenance(data),/未标建议/);
 const four=DEFAULT_FORMATS.find(f=>f.id==='four-panel');
 assert.ok(annotateResult({...sample(),characters:sample().characters.map(c=>({...c,multiViewPrompt:'[0.画面要求]【造型建议】中性柔光'}))},four).characters[0].multiViewPrompt.includes('[24.背景与渲染]'));
});
