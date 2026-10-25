import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {restoreSectionSidecars} from '../src/extraction-section-provenance.js';
import {DEFAULT_FORMATS} from '../src/character-prompt-formats.js';
import {preserveIdentity} from '../src/asset-provenance.js';
import {parseExtractionJSON} from '../src/extraction-recovery.js';
const format=DEFAULT_FORMATS.find(f=>f.id==='side-portrait'),variables={'章节正文':'林岚是成年女性。','项目画风':'现代写实插画'};
const sections=()=>Array.from({length:22},(_,section)=>({section,sourceFacts:section===0?[{sourceKind:'projectStyle',text:'现代写实插画'}]:section===1?[{text:'成年女性',quote:'林岚是成年女性',occurrence:1}]:[],suggestions:section===12?['自然黑色']:[]}));
const raw=()=>({name:' 林岚 ',role:'维修员',aliases:[],appearance:'成年女性',physique:'正文未明确',clothing:'正文未明确',personality:'正文未明确',props:'',consistencyPrompt:'林岚',multiViewPrompt:'模型自由文本不得信任',voiceLanguage:'建议普通话',voiceAge:'建议成年',voiceTimbre:'建议自然',identityName:'林岚',entityType:'character',variantName:'',sectionProvenance:sections(),sectionReview:{status:'model-says-perfect',requiresHumanReview:false}});
test('actual runtime validation restores sidecars through installed legacy parser and recomputes review from sources',()=>{
 const parser=fs.readFileSync(path.join(process.env.LOCALAPPDATA,'YingceCanvas/versions/1.3.13/web/dist/assets/character-parser-v3.js'),'utf8');
 const parseCharacters=new Function(parser.slice(parser.indexOf('function s(e)'),parser.indexOf('var p=e('))+';return f;')();
 const code=fs.readFileSync(new URL('../src/asset-extraction-runtime-v3.js',import.meta.url),'utf8'),body=code.slice(code.indexOf('export function validateAssets('),code.indexOf('export async function requestExtraction(')).replace('export ','');
 const validate=new Function('initializeCharacters','parseExtractionJSON','RFPreserveIdentity','parseCharacters','restoreSectionSidecars',body+';return validateAssets;')(()=>{},parseExtractionJSON,preserveIdentity,parseCharacters,restoreSectionSidecars);
 const result=validate(JSON.stringify({characters:[raw()],scenes:[],props:[]}),{variables,format}).characters[0];
 assert.equal(result.sectionProvenance.length,22);assert.equal(result.sectionReview.status,'host-rendered-facts-and-suggestions');assert.equal(result.sectionReview.requiresHumanReview,true);assert.equal(result.sectionReview.verifiedSourceSpans[0].text,'成年女性');assert.ok(!result.multiViewPrompt.includes('自由文本'));assert.match(result.multiViewPrompt,/【造型建议】自然黑色/);assert.equal(result.identityName,'林岚');
});
test('same-name duplicate, absent main-name match and missing context reject without alias or order association',()=>{
 assert.throws(()=>restoreSectionSidecars([{name:'林岚'}],[raw(),raw()],variables,format),/丢失或合并/);
 assert.throws(()=>restoreSectionSidecars([{name:'林岚'},{name:'林岚'}],[raw(),raw()],variables,format),/不唯一/);
 assert.throws(()=>restoreSectionSidecars([{name:'陈墨'}],[raw()],variables,format),/缺失或不唯一/);
 assert.throws(()=>restoreSectionSidecars([{name:'林岚'}],[raw()]),/结合提交时正文/);
});
test('legacy payload without section structure cannot smuggle model-supplied accepted review',()=>{
 const result=restoreSectionSidecars([{name:'林岚',sectionReview:{status:'perfect'},sectionProvenance:[{section:0}]}],[{name:'林岚'}]);
 assert.equal(result[0].sectionReview,undefined);assert.equal(result[0].sectionProvenance,undefined);
});
test('actual v7 response is rejected offline for generic section suggestions with no supplier calls',()=>{
 const root=new URL('../../影策审计-20261025/',import.meta.url),data=JSON.parse(fs.readFileSync(new URL('repair-live-extraction-v7sections-gemini-3.1-pro-preview-side-portrait.content.txt',root),'utf8'));
 const vars=JSON.parse(fs.readFileSync(new URL('repair-live-extraction-v7sections-inputs.json',root),'utf8')).labeled;
 const tpl=JSON.parse(fs.readFileSync(new URL('repair-live-extraction-v7sections-templates.json',root),'utf8')).find(f=>f.id==='side-portrait');
 assert.throws(()=>restoreSectionSidecars(data.characters.map(({sectionProvenance,sectionReview,...c})=>c),data.characters,vars,tpl),/建议仅重复栏目或空泛占位/);
});
