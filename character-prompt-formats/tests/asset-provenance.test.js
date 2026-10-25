import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareCandidates,preserveIdentity,sourceLabel,provenancePanel,enrichAssetProvenance} from '../src/asset-provenance.js';
test('same identity normalizes an explicit costume into one character name',()=>{
 const [a]=prepareCandidates([{unitId:'ch2',name:'周虎（飞鱼服）',category:'character',details:{identityName:'周虎',variantName:'飞鱼服',entityType:'character'}}],[{id:'ch1',title:'1'},{id:'ch2',title:'2'}]);
 assert.equal(a.name,'周虎');assert.equal(a.details.extractionVariantKey,'飞鱼服');assert.ok(a.details.aliases.includes('周虎(飞鱼服)'));assert.equal(a.details.extractionChapterTitle,'2');
});
test('layout and prose differences do not produce visual variants',()=>{
 const [a,b]=prepareCandidates([{name:'周虎',category:'character',details:{clothing:'黑色飞鱼服',multiViewPrompt:'四联'}},{name:'周虎',category:'character',details:{clothing:'身穿黑飞鱼服',multiViewPrompt:'双联'}}]);
 assert.equal(a.details.extractionVariantKey,'default');assert.equal(b.details.extractionVariantKey,'default');
});
test('known unambiguous aliases reuse the canonical subject',()=>{
 const [a]=prepareCandidates([{name:'周千户',category:'character',details:{}}],[],[{name:'周虎',category:'character',details:{aliases:['周千户']}}]);
 assert.equal(a.name,'周虎');
});
test('raw creature identity metadata survives the app character parser',()=>{
 const a=preserveIdentity([{name:'灵狼',appearance:'银毛'}],[{name:'灵狼',identityName:'灵狼',entityType:'creature',variantName:'受伤'}])[0];
 assert.equal(a.entityType,'creature');assert.equal(a.variantName,'受伤');
});
test('source labels use stored chapter snapshots and never invent an unknown chapter',()=>{
 const a={detailsJson:JSON.stringify({extractionProvenance:{sources:[{chapterNumber:3,chapterTitle:'夜战'},{chapterNumber:1,chapterTitle:'1'}]}})};
 assert.equal(sourceLabel(a),'第1章、第3章「夜战」提取');assert.equal(sourceLabel({}),'来源章节待核实');
});
test('every visible variant retains its own source in the card details',()=>{
 const runtime={jsx:(tag,props)=>({tag,...props}),jsxs:(tag,props)=>({tag,...props})};
 const a={details:{extractionProvenance:{sources:[{chapterNumber:1}],variants:[{key:'default',name:'基础造型',sources:[{chapterNumber:1}],details:{}},{key:'armor',name:'铠甲',sources:[{chapterNumber:3}],details:{clothing:'银甲'}}]}}};
 const text=JSON.stringify(provenancePanel(a,[],runtime));assert.ok(text.includes('第1章提取'));assert.ok(text.includes('第3章提取'));assert.ok(text.includes('铠甲'));
});
test('confirmed cards explicitly fetch confirmed candidates instead of the default pending list',async()=>{
 const original=globalThis.fetch;const urls=[];
 const provenance={sources:[{chapterNumber:2,chapterTitle:'2'}],variants:[]};
 globalThis.fetch=async url=>{urls.push(url);return {ok:true,json:async()=>({code:0,data:{total:1,candidates:url.includes('status=confirmed')?[{resolvedAssetId:'asset',detailsJson:JSON.stringify({extractionProvenance:provenance})}]:[]}})};};
 try{const assets=await enrichAssetProvenance('p',[{id:'asset',title:'周虎',category:'character'}]);assert.equal(sourceLabel(assets[0]),'第2章提取');assert.ok(urls.every(u=>u.includes('status=confirmed')));}finally{globalThis.fetch=original;}
});
