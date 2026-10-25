import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
import {characterImagePrompt} from '../src/character-image-contract.js';
test('F04 actual prepared image task cannot read the extraction JSON template, including fallback branch',async()=>{
 const s=fs.readFileSync(new URL('../src/assets-BpSjmEjz.js',import.meta.url),'utf8');const code=s.slice(s.indexOf('async function Ut('),s.indexOf('function Wt(',s.indexOf('async function Ut(')));
 for(const existing of ['', '保留角色自有双联提示词']){
  let request;
  const run=new Function('He','RFAuditCharacterImage','Wt','R','kt','L','bt','B','Dt',code+';return Ut;')(()=>existing,characterImagePrompt,()=>({}),()=>({model:'image'}),()=>null,()=>false,async r=>{request=r},{CharacterTurnaround:'character_turnaround'},x=>x);
  await run({name:'无尘',definition:{role:'修行者'},config:{imageModel:'image'},projectId:'p',assetId:'a',versionId:'v',projectStyle:{title:'水墨'}});
  assert.equal(request.mode,'image');assert.equal(request.metadata.promptTemplateOperation,undefined);assert.equal(request.metadata.promptTemplateVariables,undefined);assert.equal(request.metadata.characterAssetId,'a');
  assert.equal(request.prompt,existing||characterImagePrompt('无尘',{role:'修行者'},{title:'水墨'}));
 }
});
test('F18 prepared desktop modules use local workbench persistence wording',()=>{
 for(const n of ['project-B6TxOaS-.js','user-data-sync-B6hrlYAn.js']){
  const s=fs.readFileSync(new URL('../src/'+n,import.meta.url),'utf8');assert.ok(s.includes('已保存到本机工作台'));assert.ok(!s.includes('已保存到云端'));
 }
});
