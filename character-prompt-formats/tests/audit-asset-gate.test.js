import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {normalizeDetailedRows} from '../src/storyboard-detail-normalize.js';
const role=(id,title,aliases=[])=>({id,title,category:'character',primaryVersionId:'v-'+id,definition:{aliases}});
const row=()=>({plotDescription:'医生走进房间。',characters:[],assetBindings:[],videoMotionPrompt:'医生走进房间。'});
const catalog=[role('a','王医生',['医生']),role('b','李医生',['医生'])];
test('F12 save gate rejects an unresolved alias before any downstream write',()=>{
 for(const c of [catalog,[...catalog].reverse()])assert.throws(()=>normalizeDetailedRows([row()],c),/素材引用歧义.*医生/);
});
test('F12 a precise assetBinding resolves only the relevant shared alias',()=>{
 const input=row();input.assetBindings=[{nodeId:'b',role:'character'}];
 const out=normalizeDetailedRows([input],catalog)[0];
 assert.deepEqual(out.assetBindings.map(x=>x.nodeId),['b']);assert.ok(out.videoMotionPrompt.includes('@[asset:b]'));
 assert.ok(!out.videoMotionPrompt.includes('@[asset:a]'));
 const ambiguousOther=[...catalog,{id:'s1',title:'旧仓库',category:'environment',primaryVersionId:'vs1',definition:{aliases:['仓库']}},{id:'s2',title:'新仓库',category:'environment',primaryVersionId:'vs2',definition:{aliases:['仓库']}}];
 assert.throws(()=>normalizeDetailedRows([{...input,videoMotionPrompt:'医生走进仓库。'}],ambiguousOther),/素材引用歧义.*仓库/);
});
test('F12 precise characterAssetId and inline token take precedence over an unresolved duplicate',()=>{
 const duplicate=[role('a','王医生'),{id:'candidate:b',title:'王医生',category:'character',pending:true}];
 const input={plotDescription:'王医生站立。',characters:[{characterName:'王医生',characterAssetId:'a'}],assetBindings:[],videoMotionPrompt:'王医生站立。'};
 const out=normalizeDetailedRows([input],duplicate)[0];
 assert.deepEqual(out.assetBindings.map(x=>x.nodeId),['a']);
 const token=normalizeDetailedRows([{...row(),plotDescription:'',videoMotionPrompt:'@[asset:b] 走进房间。'}],catalog)[0];
 assert.deepEqual(token.assetBindings.map(x=>x.nodeId),['b']);
});
test('F12 two explicit matching identities do not resolve a still-generic name',()=>{
 assert.throws(()=>normalizeDetailedRows([{...row(),assetBindings:[{nodeId:'a'},{nodeId:'b'}]}],catalog),/素材引用歧义/);
});
test('F12 conflicting character ID/name and unresolved diagnostic markers are rejected',()=>{
 assert.throws(()=>normalizeDetailedRows([{...row(),characters:[{characterName:'王医生',characterAssetId:'b'}]}],catalog),/角色ID与名称冲突/);
 assert.throws(()=>normalizeDetailedRows([{...row(),videoMotionPrompt:'医生站立。\n【素材引用待核对】仍有同名人物。'}],catalog),/未解决.*歧义/);
});
test('F12 historical valid rows normalize, while the actual unbound ambiguous bayonet row is rejected',()=>{
 const read=n=>JSON.parse(fs.readFileSync(new URL('../build/storyboard-detail-v12/'+n,import.meta.url),'utf8'));
 const history=read('gemini-rich-2.storyboard.json').rows;
 const assets=read('catalog.json').map(a=>({...a,primaryVersionId:a.primary_version_id}));
 history.forEach((r,i)=>{if(i===5)assert.throws(()=>normalizeDetailedRows([r],assets),/素材引用歧义.*刺刀/);else assert.equal(normalizeDetailedRows([r],assets).length,1);});
 const corrected=structuredClone(history[5]);const exact=assets.find(a=>a.title==='北洋军警长枪与刺刀');assert.ok(exact);
 // Naming the exact catalog identity also resolves the ambiguity, without
 // inventing a token or choosing whichever generic alias happens to come first.
 corrected.plotDescription=String(corrected.plotDescription||'').replaceAll('刺刀',exact.title);
 corrected.videoMotionPrompt=corrected.videoMotionPrompt.replaceAll('刺刀',exact.title);
 assert.equal(normalizeDetailedRows([corrected],assets).length,1);
});
