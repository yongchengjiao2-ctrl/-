import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_FORMATS,buildExtractionPrompt,annotateResult} from '../src/character-prompt-formats.js';
const four=DEFAULT_FORMATS.find(f=>f.id==='four-panel');
test('four-panel transmits compact JSON instruction and preserves chosen full layout on save',()=>{
 const prompt=buildExtractionPrompt({'章节正文':'测试'},four);
 assert.ok(prompt.includes('【所选版式JSON传输规则'));
 const result=annotateResult({characters:[{name:'人物甲',multiViewPrompt:'[0.画面要求]国画\n[1.基础档案]人物甲\n[21.鞋靴]布鞋'}],scenes:[],props:[]},four);
 const full=result.characters[0].multiViewPrompt;
 for(const text of ['[0.画面要求]国画','第一栏正面无头服饰展示','严格90度左侧面人物','占画宽约40%','[23.负面排障指令]','[24.背景与渲染]'])assert.ok(full.includes(text),text);
 assert.equal(annotateResult(result,four).characters[0].multiViewPrompt,full);
});
test('five-panel content is unchanged; four-panel custom layout survives expansion',()=>{
 const original=DEFAULT_FORMATS.find(f=>f.id==='original');const data={characters:[{multiViewPrompt:'原有五视图'}],scenes:[],props:[]};
 assert.equal(annotateResult(data,original),data);
 assert.ok(!buildExtractionPrompt({},original).includes('【所选版式JSON传输规则'));
 const custom={...four,content:four.content.replace('占画宽约40%','占画宽约45%')};
 assert.ok(annotateResult(data,custom).characters[0].multiViewPrompt.includes('占画宽约45%'));
});

