import test from 'node:test';import assert from 'node:assert/strict';
import {textRequestPolicy} from '../src/text-request-policy.js';
import {characterImagePrompt} from '../src/character-image-contract.js';
test('F05 native provider and unrelated user options survive unchanged',()=>{
 for(const protocol of ['gemini-generate-content','claude-api','a6api-chat']){
  const input={model:'c::m',channels:[{id:'c',models:['m'],interfaceType:protocol,modelCosts:[{model:'m',defaultOptions:{temperature:.3,max_tokens:2048}}]}]};
  const original=structuredClone(input),p=textRequestPolicy(input);
  assert.deepEqual(input,original);assert.equal(p.config.channels[0].interfaceType,protocol);assert.equal(p.config.channels[0].modelCosts[0].protocol,protocol);assert.equal(p.providerOptions[protocol].temperature,.3);assert.equal(p.providerOptions[protocol].max_tokens,2048);
  if(protocol!=='a6api-chat')assert.equal(p.providerOptions[protocol].response_format,undefined);
 }
});
test('F05 route resolution is explicit, disabled and ambiguous channels fail before submission',()=>{
 assert.throws(()=>textRequestPolicy({model:'m',channels:[{id:'a',models:['m']},{id:'b',models:['m']}]}),/同名/);
 assert.throws(()=>textRequestPolicy({model:'c::m',channels:[{id:'c',models:['m'],enabled:false}]}),/停用/);
 const p=textRequestPolicy({model:'c::m',channels:[{id:'c',models:['m'],scope:'system',modelCosts:[{model:'m',logicalModelId:'logical'}]}]});assert.deepEqual(p.providerOptions,{});assert.equal(p.diagnostic.logical,true);
});
test('F04 missing multiview uses image-only fallback independent of asset JSON templates',()=>{
 const prompt=characterImagePrompt('无尘',{role:'成年修行者',appearance:'银发，兽形耳朵'},{title:'水墨'});
 assert.ok(prompt.includes('水墨'));assert.ok(prompt.includes('银发'));assert.ok(prompt.includes('只生成图片'));assert.ok(!prompt.includes('characters'));assert.throws(()=>characterImagePrompt('空角色'),/填写/);
});
