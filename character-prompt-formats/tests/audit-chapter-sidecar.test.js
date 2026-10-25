import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {restoreSectionSidecars} from '../src/extraction-section-provenance.js';
import {attachExtractionReview} from '../src/asset-provenance.js';
import {DEFAULT_FORMATS,annotateResult} from '../src/character-prompt-formats.js';
import {parseExtractionJSON} from '../src/extraction-recovery.js';
const chapter=fs.readFileSync(new URL('../src/chapters-CeKTBaiU.js',import.meta.url),'utf8');
const parserCode=fs.readFileSync(path.join(process.env.LOCALAPPDATA,'YingceCanvas/versions/1.3.13/web/dist/assets/character-parser-v3.js'),'utf8');
const parser=new Function(parserCode.slice(parserCode.indexOf('function s(e)'),parserCode.indexOf('var p=e('))+';return f;')();
const mnCode=chapter.slice(chapter.indexOf('function mn('),chapter.indexOf('var hn=',chapter.indexOf('function mn(')));
const mn=new Function('RFParseExtractionJSON','RFAuditAttachReview','et','RFAuditRestoreSections',mnCode+';return mn;')(parseExtractionJSON,attachExtractionReview,parser,restoreSectionSidecars);
const format=DEFAULT_FORMATS.find(f=>f.id==='side-portrait'),variables={'章节正文':'林岚是成年女性。','项目画风':'现代写实插画'};
const char=()=>({name:'林岚',role:'维修员',aliases:[],appearance:'成年女性',physique:'成年女性体态',clothing:'灰外套',personality:'正文未明确',props:'',consistencyPrompt:'林岚',multiViewPrompt:'自由文本不应被当成真实已验正文',voiceLanguage:'普通话',voiceAge:'成年',voiceTimbre:'建议自然',sectionReview:{status:'模型声称完美'},sectionProvenance:Array.from({length:22},(_,section)=>({section,sourceFacts:section===0?[{text:'现代写实插画',sourceKind:'projectStyle'}]:section===1?[{text:'成年女性',quote:'林岚是成年女性',occurrence:1}]:[],suggestions:section===12?['自然黑色']:[]}))});
const data=()=>({characters:[char()],scenes:[],props:[],coverageAssessment:{status:'unverified',checkedScopes:[],requiresHumanReview:true}});

test('actual compiled-source mn second parse retains legal sidecars and recomputes review using original sources',()=>{
 const result=mn(JSON.stringify(data()),{variables,format}).characters[0];
 assert.equal(result.sectionProvenance.length,22);assert.equal(result.sectionReview.status,'host-rendered-facts-and-suggestions');assert.equal(result.sectionReview.requiresHumanReview,true);assert.equal(result.extractionReview.requiresHumanReview,true);assert.match(result.multiViewPrompt,/【原文事实】成年女性/);assert.match(result.multiViewPrompt,/【造型建议】自然黑色/);assert.ok(!result.multiViewPrompt.includes('自由文本'));
});
test('actual mn rejects duplicate names, missing snapshot context and copied-title suggestions',()=>{
 const duplicate=data();duplicate.characters.push(char());assert.throws(()=>mn(JSON.stringify(duplicate),{variables,format}),/丢失或合并|不唯一/);
 assert.throws(()=>mn(JSON.stringify(data())),/结合提交时正文和模板/);
 const placeholder=data();placeholder.characters[0].sectionProvenance[12].suggestions=['发色设计'];assert.throws(()=>mn(JSON.stringify(placeholder),{variables,format}),/建议仅重复栏目/);
});
test('actual mn keeps legacy no-sidecar data compatible and never trusts model accepted review',()=>{
 const old=data();delete old.characters[0].sectionProvenance;const result=mn(JSON.stringify(old));assert.equal(result.characters[0].name,'林岚');assert.equal(result.characters[0].sectionReview,undefined);
});
test('actual yn reuses same submitted variables and format snapshot for mn despite later UI-style change',async()=>{
 const code=chapter.slice(chapter.indexOf('async function yn('),chapter.indexOf('async function bn(',chapter.indexOf('async function yn(')));
 const e={projectName:'虚构项目',chapterTitle:'测试',projectStyle:'现代写实插画',sourceText:'林岚是成年女性。',roleFormat:format};
 let submitted,context;
 const xn=async(_e,operation,vars)=>{assert.equal(operation,'chapter_character_breakdown');submitted=vars;e.roleFormat={id:'original',content:'后续切换，不可影响旧请求'};return JSON.stringify(data());};
 const captureMn=(text,c)=>{context=c;return mn(text,c);};
 const yn=new Function('RFAnnotate','mn','xn',code+';return yn;')(annotateResult,captureMn,xn);
 const result=await yn(e,{});
 assert.equal(context.variables,submitted);assert.equal(context.format,format);assert.ok(submitted['章节正文'].startsWith(e.sourceText));assert.ok(submitted['章节正文'].includes('素材覆盖要求'));assert.ok(result.characters[0].multiViewPrompt.includes('[22.摄影排版指令]'));
 assert.ok(chapter.includes('onReviewRetry:()=>control.beginRetry()'));
});
