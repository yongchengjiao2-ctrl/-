import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sourceCoverage,coverageAssessment,assertSourceCoverage,assertFormatCompleteness} from '../src/extraction-completeness-v4.js';
import {DEFAULT_FORMATS,buildExtractionPrompt,expandFourPanelPrompt,fixedLayoutSections,loadManagedFormats} from '../src/character-prompt-formats.js';

const assets=(names=[],scenes=[],props=[])=>({characters:names.map(name=>({name,aliases:[]})),scenes:scenes.map(name=>({name})),props:props.map(name=>({name}))});
const complete=()=>Array.from({length:22},(_,i)=>`[${i}.设定]正文未明确，造型建议保持自然。`).join('\n');

test('F07 ordinary prose remains usable but returns explicit unverified coverage instead of a vacuous success',()=>{
 const variables={'章节正文':'张三拿起钥匙，和李四走进仓库。'};
 const assessment=assertSourceCoverage(assets(['张三','李四'],['仓库'],['钥匙']),variables);
 assert.equal(assessment.status,'unverified');assert.equal(assessment.requiresHumanReview,true);
 assert.deepEqual(assessment.checkedScopes,[]);assert.match(assessment.reason,/人工核对/);
 const empty=assertSourceCoverage(assets(),variables);assert.equal(empty.emptyResult,true);assert.match(empty.reason,/不能据此断言正文无资产/);
});

test('F07 explicit tags report their actual partial scope and check named props when supplied',()=>{
 const variables={'章节正文':'人物：无人物\n场景：无忧宫\n道具：铜钥匙'};
 const result=assertSourceCoverage(assets([],['无忧宫'],['铜钥匙']),variables);
 assert.equal(result.status,'labeled-partial');assert.deepEqual(result.checkedScopes,['people','scenes','props']);
 assert.throws(()=>assertSourceCoverage(assets([],['无忧宫']),variables),/道具独立建卡：铜钥匙/);
 assert.equal(coverageAssessment({'章节正文':''}).status,'unverified');
});

test('F08 names beginning with 无 survive while exact no-person and historical-image markers do not become people',()=>{
 const variables={'章节正文':'人物：无尘、无忌、无名\n场景：无忧宫'};
 assert.deepEqual(sourceCoverage(variables).people,['无尘','无忌','无名']);
 assert.throws(()=>assertSourceCoverage(assets(['无尘'],['无忧宫']),variables),/无忌/);
 assert.doesNotThrow(()=>assertSourceCoverage(assets(['无尘','无忌','无名'],['无忧宫']),variables));
 assert.deepEqual(sourceCoverage({'章节正文':'人物：无人物、历史意象定格\n场景：无场景'}),{people:[],scenes:[]});
});

test('F09 generic groups never turn into an empty matching token',()=>{
 assert.throws(()=>assertSourceCoverage(assets(['张三']),{'章节正文':'人物：群众'}),/角色独立建卡：群众/);
 assert.doesNotThrow(()=>assertSourceCoverage(assets(['群众']),{'章节正文':'人物：群众'}));
 assert.throws(()=>assertSourceCoverage(assets(['学生代表']),{'章节正文':'人物：工人代表'}),/工人代表/);
 assert.throws(()=>assertSourceCoverage(assets(['欢迎群众']),{'章节正文':'人物：旁听席'}),/旁听群众/);
});

test('F10 empty headings, empty titles, placeholders and duplicated numbered sections cannot pass',()=>{
 const check=prompt=>assertFormatCompleteness({characters:[{name:'甲',multiViewPrompt:prompt}]},{id:'four-panel'});
 assert.throws(()=>check(Array.from({length:22},(_,i)=>`[${i}.]`).join('\n')),/内容为空或占位/);
 assert.throws(()=>check(complete().replace('[15.设定]正文未明确，造型建议保持自然。','[15.设定]   ')),/第15节内容为空/);
 assert.throws(()=>check(complete().replace('[15.设定]正文未明确，造型建议保持自然。','[15.设定]同上')),/第15节内容为空/);
 assert.throws(()=>check(complete()+'\n[15.设定]灰色外衣'),/第15节重复/);
 assert.doesNotThrow(()=>check(complete()));
 assert.doesNotThrow(()=>check(complete().replace('[15.设定]正文未明确，造型建议保持自然。','[15.服装配色层次：黑蓝灰青。]')));
});

test('F10 inline references in fixed layout do not count as duplicate numbered definitions',()=>{
 const prompt=complete()+'\n[24.背景与渲染]继承[0.画面要求]的画风。';
 assert.doesNotThrow(()=>assertFormatCompleteness({characters:[{name:'甲',multiViewPrompt:prompt}]},{id:'side-portrait'}));
});

test('F15 repeated definition anchors reject a template before any model call, not splice the first example',()=>{
 const format=DEFAULT_FORMATS.find(f=>f.id==='four-panel');
 const duplicated={...format,content:'说明示例[22.摄影排版指令]：错误例子\n[23.负面排障指令]：说明\n'+format.content};
 assert.throws(()=>expandFourPanelPrompt('[0.画面要求]水彩',duplicated),/有且仅有一处/);
 assert.throws(()=>buildExtractionPrompt({'章节正文':'测试'},duplicated),/有且仅有一处/);
 assert.throws(()=>fixedLayoutSections('[23.负面排障指令]：禁止裁切\n[22.摄影排版指令]：两视图'),/顺序或分区无效/);
 assert.throws(()=>fixedLayoutSections('[22.摄影排版指令]：\n[23.负面排障指令]：禁止裁切'),/内容为空/);
});

test('F15 half-width punctuation and period variations preserve actual fixed text and remain idempotent',()=>{
 const format={id:'side-portrait',content:'[22．摄影排版指令]:左全身右肖像。\n[23．负面排障指令]:禁止多余视图。\n【输出数据合同】\n只返回JSON。'};
 const result=expandFourPanelPrompt('[0.画面要求]水彩',format);
 assert.match(result,/左全身右肖像/);assert.match(result,/\[24\.背景与渲染\]/);assert.ok(!result.includes('只返回JSON'));
 assert.equal(expandFourPanelPrompt(result,format),result);
});

test('F15 actual managed template fixture and current built-in full templates pass fixed-layout parsing',async()=>{
 for(const format of DEFAULT_FORMATS.filter(f=>f.id!=='original'))assert.doesNotThrow(()=>fixedLayoutSections(format.content));
 const actual=JSON.parse(fs.readFileSync(new URL('../build/managed-verify/catalog-actual.json',import.meta.url),'utf8'));
 const formats=await loadManagedFormats(()=>actual.data);
 for(const format of formats.filter(f=>f.id!=='original'))assert.doesNotThrow(()=>fixedLayoutSections(format.content));
});
