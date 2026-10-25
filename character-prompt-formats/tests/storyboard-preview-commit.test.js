import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import{validateStoryboardRows}from '../src/storyboard-complete.js';
const source=fs.readFileSync(path.join(process.env.LOCALAPPDATA,'YingceCanvas/versions/1.3.13/web/dist/assets/chapters-CeKTBaiU.js'),'utf8');
const dir=new URL('../build/storyboard-detail-v12/',import.meta.url),read=n=>JSON.parse(fs.readFileSync(new URL(n,dir),'utf8'));
test('installed generation requests text preview and saves only through the validated commit callback',()=>{
 const block=source.slice(source.indexOf('async function bn('),source.indexOf('async function xn('));assert.ok(block.includes('RFPlannedChapter'));const runtime=fs.readFileSync(path.join(process.env.LOCALAPPDATA,'YingceCanvas/versions/1.3.13/web/dist/assets/storyboard-planned-runtime.js'),'utf8');assert.ok(runtime.includes("operation:'text'"));assert.ok(runtime.includes('short-drama-chapter-storyboard-preview'));assert.ok(!runtime.includes("operation:'storyboard'"));assert.ok(source.includes('l=await on(n.id,o.rows)'));
 assert.ok(source.includes('Sn(n.inputJson).source!==`short-drama-chapter-storyboard-preview`&&e.shots.some'));
});
test('real incomplete model response never reaches the project write API',async()=>{
 const start=source.indexOf('on=async(t,n)=>'),end=source.indexOf(',sn=async()=>',start),expression=source.slice(start+3,end);let writes=0;
 // Keep the real full catalog for ambiguity tests. Dropping pending candidates
 // would erase the conflict before the save gate gets a chance to detect it.
 const catalog=read('catalog.json').map(a=>({...a,primaryVersionId:a.primary_version_id})),unit={id:'unit',sourceText:fs.readFileSync(new URL('narration.txt',dir),'utf8')};
 const commit=new Function('e','RFPrepareRows','nn','RFValidateStoryboardRows','RFReferenceCatalog','Ln','yt','RFRepair','u','$t','return '+expression)({project:{id:'project'},units:[unit],shots:[]},x=>x,x=>x,validateStoryboardRows,()=>catalog,x=>x,async()=>writes++,async()=>{}, {invalidateQueries:async()=>{}},()=>{});
 const incomplete=read('gemini-rich-1.storyboard.json').rows;incomplete[0].dialogue+='这句是原文没有的配音。';
 await assert.rejects(commit('unit',incomplete),/校验|配音/);assert.equal(writes,0);
 const historical=read('gemini-rich-2.storyboard.json').rows;
 // This saved result uses the generic “刺刀” for three overlapping catalog
 // entries. A formerly accepted preview must not bypass identity resolution.
 await assert.rejects(commit('unit',historical),/素材引用歧义.*刺刀/);assert.equal(writes,0);
 const corrected=structuredClone(historical),bayonet=catalog.find(a=>!a.pending&&a.title==='北洋军警长枪与刺刀');
 assert.ok(bayonet?.id);assert.ok(bayonet.primaryVersionId);
 corrected[5].assetBindings.push({nodeId:bayonet.id,role:'prop'});
 const checked=validateStoryboardRows(corrected,catalog,unit.sourceText);
 assert.equal(checked.length,12);
 const realIds=new Set(catalog.filter(a=>!a.pending).map(a=>a.id));
 for(const row of checked){
  for(const binding of row.assetBindings){assert.ok(realIds.has(binding.nodeId));assert.ok(!binding.nodeId.startsWith('candidate:'));}
  for(const character of row.characters)if(character.characterAssetId)assert.ok(realIds.has(character.characterAssetId));
  for(const token of row.videoMotionPrompt.matchAll(/@\[asset:([^\]]+)\]/g))assert.ok(realIds.has(token[1]));
 }
 assert.ok(checked[5].assetBindings.some(b=>b.nodeId===bayonet.id&&b.role==='prop'));
 assert.equal(await commit('unit',corrected),12);assert.equal(writes,1);
});
