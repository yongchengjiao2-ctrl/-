import test from 'node:test';import assert from 'node:assert/strict';
import {buildExtractionContractPrompt,extractionOutputExample} from '../src/extraction-contract-builder.js';
import {DEFAULT_FORMATS} from '../src/character-prompt-formats.js';
test('final contract preserves administrator extraction/layout while replacing the old output example',()=>{
 for(const format of DEFAULT_FORMATS){
  const before=JSON.stringify(format),prompt=buildExtractionContractPrompt({format,variables:{章节正文:'甲拿钥匙。'},identityRules:'identity',coverage:'coverage',compact:'compact'});
  assert.equal(JSON.stringify(format),before);assert.ok(prompt.includes(format.content.split('【输出数据合同】')[0].trimEnd()));
  assert.ok(!prompt.includes('【JSON序列化合同】'));assert.ok(!prompt.includes('【输出数据合同】'));assert.equal((prompt.match(/【唯一最终输出合同 v6b】/g)||[]).length,1);
  assert.ok(prompt.lastIndexOf('sourceInventory')>prompt.indexOf('【输入数据'));assert.ok(prompt.includes('personality只写原文明示性格'));
 }
});
test('one complete example carries all required asset provenance and exact source links',()=>{
 const data=extractionOutputExample();assert.deepEqual(Object.keys(data),['characters','scenes','props','sourceInventory']);
 for(const key of ['characters','scenes','props'])for(const asset of data[key]){assert.ok(asset.identityName);assert.ok(asset.entityType);assert.equal(typeof asset.variantName,'string');assert.ok(Array.isArray(asset.visualProvenance.sourceFacts));assert.ok(Array.isArray(asset.visualProvenance.suggestions));}
 assert.equal(data.sourceInventory[0].occurrence,1);
});
