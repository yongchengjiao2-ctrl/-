import test from 'node:test';
import assert from 'node:assert/strict';
import {locateSourceQuote,validateSourceInventory,validateVisualProvenance} from '../src/extraction-source-inventory.js';
const variables={'章节正文':'林岚从木桌上拿起铜钥匙。陈墨接过铜钥匙。'};
const row=(kind,name,quote,assetName=name,occurrence=1)=>({kind,name,quote,occurrence,assetName,disposition:'asset',reason:'正文明确出现并需要制作'});
const sample=()=>({characters:[{name:'林岚'},{name:'陈墨'}],scenes:[],props:[{name:'木桌'},{name:'铜钥匙'}],sourceInventory:[row('character','林岚','林岚'),row('character','陈墨','陈墨'),row('prop','木桌','木桌'),row('prop','铜钥匙','铜钥匙')]});

test('v6 pure check links exact real quotes to the correct generated category and preserves human-review requirement',()=>{
 const result=validateSourceInventory(sample(),variables);
 assert.equal(result.status,'self-inventory-linked');assert.equal(result.mappedAssetCount,4);assert.equal(result.requiresHumanReview,true);
 assert.deepEqual(result.spans[2],{index:2,kind:'prop',name:'木桌',assetName:'木桌',quote:'木桌',occurrence:1,start:3,end:5,unit:'utf16-code-unit'});
});
test('known self-inventory item missing a generated prop is rejected without hardcoding 木桌',()=>{
 const data=sample();data.props=data.props.filter(p=>p.name!=='木桌');assert.throws(()=>validateSourceInventory(data,variables),/未映射至props实际资产/);
 const generic={characters:[],scenes:[],props:[],sourceInventory:[row('prop','齿轮','齿轮')]};assert.throws(()=>validateSourceInventory(generic,{'章节正文':'齿轮掉落。'}),/齿轮未映射至props/);
});
test('v6 missing inventory, empty inventory and forged quote are rejected; legacy does not acquire new mandatory schema',()=>{
 assert.throws(()=>validateSourceInventory({characters:[],scenes:[],props:[]},variables),/要求顶层sourceInventory/);
 assert.throws(()=>validateSourceInventory({sourceInventory:[]},variables),/非空正文/);
 const data=sample();data.sourceInventory[0].quote='杜撰原句';assert.throws(()=>validateSourceInventory(data,variables),/不属于本次正文/);
 assert.equal(validateSourceInventory({},variables,{contractVersion:5}).status,'legacy-unchecked');
});
test('host computes quote occurrence spans including emoji instead of trusting model offsets',()=>{
 assert.deepEqual(locateSourceQuote('😀钥匙，钥匙','钥匙',2),{start:5,end:7,unit:'utf16-code-unit'});
 assert.throws(()=>locateSourceQuote('钥匙','钥匙',2),/出现次数/);assert.throws(()=>locateSourceQuote('钥匙','钥匙',0),/正整数/);
});
test('extra invented asset and category mismatches cannot masquerade as source-backed',()=>{
 const data=sample();data.props.push({name:'枪'});assert.throws(()=>validateSourceInventory(data,variables),/枪缺少对应/);
 const mismatch=sample();mismatch.sourceInventory[2].kind='environment';assert.throws(()=>validateSourceInventory(mismatch,variables),/scenes实际资产/);
});
test('a legitimately non-asset text may be self-reported without inventing an entity, but remains unproved',()=>{
 const result=validateSourceInventory({characters:[],scenes:[],props:[],sourceInventory:[{kind:'other',name:'篇章结束标记',quote:'完',occurrence:1,assetName:'',disposition:'non_asset',reason:'结束标记，没有可制作实体'}]},{'章节正文':'完'});
 assert.equal(result.requiresHumanReview,true);assert.equal(result.mappedAssetCount,0);
});
test('visual facts and suggestions are separated with explicit prompt label, not silently treated as original fact',()=>{
 const data={characters:[{name:'林岚',multiViewPrompt:'灰色外套；【造型建议】黑色短发',visualProvenance:{sourceFacts:['灰色外套'],suggestions:['黑色短发']}}],scenes:[],props:[]};
 assert.equal(validateVisualProvenance(data).status,'provenance-declared');
 data.characters[0].multiViewPrompt='灰色外套，黑色短发';assert.throws(()=>validateVisualProvenance(data),/未标建议/);
 data.characters[0].visualProvenance.suggestions=['灰色外套'];assert.throws(()=>validateVisualProvenance(data),/同时列为原文事实/);
 assert.equal(validateVisualProvenance({}, {contractVersion:5}).status,'legacy-unchecked');
});
