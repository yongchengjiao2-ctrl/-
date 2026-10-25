import test from 'node:test';import assert from 'node:assert/strict';
import {DEFAULT_FORMATS} from '../src/character-prompt-formats.js';
import {sectionTitles,validateAndRenderSections,normalizeSectionProvenance,isSectionSuggestionPlaceholder} from '../src/extraction-section-provenance.js';
const format=DEFAULT_FORMATS.find(f=>f.id==='side-portrait'),variables={'章节正文':'林岚是成年女维修员，穿灰色外套。','项目画风':'现代写实插画'};
function character(){return {name:'林岚',multiViewPrompt:'危险：模型自由文本不应保留',sectionProvenance:Array.from({length:22},(_,section)=>({section,sourceFacts:section===0?[{text:'现代写实插画',sourceKind:'projectStyle'}]:section===2?[{text:'成年女维修员',quote:'林岚是成年女维修员',occurrence:1}]:[],suggestions:section===3?['鹅蛋脸']:[]}))};}
test('host uses current panel schema, exact source substrings and explicit suggestion labels',()=>{
 assert.equal(sectionTitles(format).length,22);const result=validateAndRenderSections(character(),variables,format);
 assert.match(result.multiViewPrompt,/\[2.基础特征\]【原文事实】成年女维修员/);assert.match(result.multiViewPrompt,/\[3.脸型骨相\]【造型建议】鹅蛋脸/);assert.match(result.multiViewPrompt,/\[4.眉毛\]正文未明确/);assert.equal(result.sectionReview.requiresHumanReview,true);
 const normalized=normalizeSectionProvenance({characters:[character()],scenes:[],props:[]},variables,format);assert.ok(!normalized.characters[0].multiViewPrompt.includes('危险'));assert.ok(normalized.characters[0].multiViewPrompt.includes('[22.摄影排版指令]'));
});
test('invented age not contained in genuine quote rejects, missing/duplicate sections reject',()=>{
 const c=character();c.sectionProvenance[2].sourceFacts[0].text='25岁';assert.throws(()=>validateAndRenderSections(c,variables,format),/不是其原文引文/);
 const absent=character();absent.sectionProvenance.pop();assert.throws(()=>validateAndRenderSections(absent,variables,format),/22项/);
 const duplicate=character();duplicate.sectionProvenance[21].section=20;assert.throws(()=>validateAndRenderSections(duplicate,variables,format),/重复/);
});
test('project style allowed only exact section zero and original five-view explicitly unsupported',()=>{
 const c=character();c.sectionProvenance[0].sourceFacts[0].text='3D国漫';assert.throws(()=>validateAndRenderSections(c,variables,format),/逐字等于/);
 const wrong=character();wrong.sectionProvenance[1].sourceFacts=[{text:'现代写实插画',sourceKind:'projectStyle'}];assert.throws(()=>validateAndRenderSections(wrong,variables,format),/只允许第0节/);
 assert.throws(()=>sectionTitles(DEFAULT_FORMATS.find(f=>f.id==='original')),/仅支持双联/);
});
test('generic repeated template titles reject without maintaining domain-specific attribute lists',()=>{
 assert.equal(isSectionSuggestionPlaceholder('造型建议：发色设计','发色'),true);
 assert.equal(isSectionSuggestionPlaceholder('【造型建议】脸型骨相设计','脸型骨相'),true);
 assert.equal(isSectionSuggestionPlaceholder('服装配色层次的细节','服装配色层次'),true);
 assert.equal(isSectionSuggestionPlaceholder('自然黑色','发色'),false);
 assert.equal(isSectionSuggestionPlaceholder('简洁的灰色与深蓝分层','服装配色层次'),false);
 const c=character();c.sectionProvenance[12].suggestions=['发色设计'];assert.throws(()=>validateAndRenderSections(c,variables,format),/第12节建议仅重复栏目/);
 const empty=character();empty.sectionProvenance[12].suggestions=[];assert.match(validateAndRenderSections(empty,variables,format).multiViewPrompt,/\[12.发色\]正文未明确/);
});
