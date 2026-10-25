import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeBindings,inferBindings,bindPrompt,referenceCatalog,prepareShotRows} from '../src/shot-asset-bindings.js';
const role=(id,title,aliases=[])=>({id,title,category:'character',primaryVersionId:'v-'+id,definition:{aliases}});

test('F01 normal scene prose survives binding, including original scene introductions and extra facts',()=>{
 const assets=[role('zhang','张三')];
 for(const scene of ['场景是废弃医院，地板有血迹。','本Seq全程发生于废弃医院，地板有血迹。','本Seq场景为废弃医院，地板有血迹。']){
  const out=bindPrompt(scene+'\n张三缓慢推门。',assets);
  assert.ok(out.includes(scene),'lost normal prose: '+scene);
  assert.equal(bindPrompt(out,assets),out);
 }
 const prose=bindPrompt('（张三 是医生）这是剧情身份说明。\n张三缓慢推门。',assets);
 assert.ok(prose.includes(' 是医生）这是剧情身份说明。'));assert.ok(prose.includes('@[asset:zhang]'));
});

test('F01 only exact machine introduction is replaced, ordinary parenthesized prose stays',()=>{
 const assets=[role('a','张三（青年）'),{id:'s',title:'仓库（地下）',category:'environment',primaryVersionId:'vs'}];
 const out=bindPrompt('张三（青年）走进仓库（地下）。\n(张三 是医生)他掩饰了身份。',assets);
 assert.ok(out.includes('(张三 是医生)他掩饰了身份。'));
 assert.equal(bindPrompt(out,assets),out);
});

test('F11 negated and voice-only names never establish visible bindings',()=>{
 const assets=[role('zhang','张三'),role('li','李四')];
 for(const text of ['画面只有李四，张三不出场。','李四站着，张三未出现。','不要出现张三，画面只有李四。','张三不在画面中出现。','张三仅被提及。','画外音：张三。','旁白：张三抵达。']){
  const actual=inferBindings({}, {videoPrompt:text},assets).map(a=>a.id);
  assert.ok(!actual.includes('zhang'),text);
 }
 assert.deepEqual(inferBindings({}, {videoPrompt:'张三走向门口。'},assets).map(a=>a.id),['zhang']);
 assert.deepEqual(inferBindings({}, {videoPrompt:'张三不出场。\n第二个画面：张三走入镜头。'},assets).map(a=>a.id),['zhang']);
});

test('F12 shared aliases stay unresolved regardless of asset order, with explicit visible diagnostics',()=>{
 const assets=[role('wang','王医生',['医生']),role('li','李医生',['医生'])];
 for(const catalog of [assets,[...assets].reverse()]){
  const analysis=analyzeBindings({}, {videoPrompt:'医生走进房间。'},catalog);
  assert.deepEqual(analysis.assets,[]);assert.equal(analysis.issues.length,1);
  assert.deepEqual(new Set(analysis.issues[0].candidates.map(a=>a.id)),new Set(['wang','li']));
  const row=prepareShotRows([{revision:{videoPrompt:'医生走进房间。'}}],{assets:catalog,assetCandidates:[]})[0];
  assert.deepEqual(row.assetVersionIds,[]);
  assert.ok(row.revision.videoPrompt.includes('素材引用待核对'));
  assert.ok(!row.revision.videoPrompt.includes('@[asset:'));
 }
});

test('F12 exact primary name resolves a shared alias without silently taking first candidate',()=>{
 const assets=[role('wang','王医生',['医生']),role('li','李医生',['医生'])];
 assert.deepEqual(inferBindings({}, {videoPrompt:'李医生走进房间。'},assets).map(a=>a.id),['li']);
 const out=bindPrompt('医生走进房间，李医生站在门口。',assets);
 assert.ok(out.includes('医生走进房间'));
 assert.ok(out.includes('@[asset:li] 站在门口'));
 assert.ok(!out.includes('@[asset:wang] 走进房间'));
});

test('F12 existing precise asset ID is preserved when duplicate names exist',()=>{
 const assets=[role('a','王医生'),role('b','王医生')];
 const text=bindPrompt('画面：@[asset:b] 站立。',assets);
 assert.ok(text.includes('画面：@[asset:b] 站立。'));
 const row=prepareShotRows([{assetVersionIds:['v-b'],revision:{videoPrompt:'王医生站立。'}}],{assets,assetCandidates:[]})[0];
 assert.deepEqual(row.assetVersionIds,['v-b']);assert.ok(!row.assetVersionIds.includes('v-a'));
});

test('F12 repeated ambiguous repair stays stable and does not infer candidates from diagnostics',()=>{
 const detail={assets:[role('a','王医生',['医生']),role('b','李医生',['医生'])],assetCandidates:[]};
 const row=prepareShotRows([{revision:{videoPrompt:'医生走进房间。'}}],detail)[0];
 const again=prepareShotRows([row],detail)[0];
 assert.deepEqual(again,row);
});

test('F13 chapter filtering happens before identity matching, without deleting same-name candidates',()=>{
 const detail={assets:[],assetCandidates:[
  {id:'old',name:'张三',category:'character',status:'pending_confirmation',unitId:'old'},
  {id:'new',name:'张三',category:'character',status:'pending_confirmation',unitId:'new'},
 ]};
 assert.equal(referenceCatalog(detail).length,2);
 assert.deepEqual(referenceCatalog(detail,'new').map(a=>a.id),['candidate:new']);
 const row=prepareShotRows([{revision:{videoPrompt:'张三走进仓库。'}}],detail,'new')[0];
 assert.deepEqual(row.assetVersionIds,[]);assert.ok(row.revision.videoPrompt.includes('@张三 是张三，待确认素材'));
 assert.ok(!row.revision.videoPrompt.includes('待核对'));
});

test('F13 different identities in the same chapter remain ambiguous rather than being collapsed by title',()=>{
 const detail={assets:[],assetCandidates:['a','b'].map(id=>({id,name:'张三',category:'character',status:'pending_confirmation',unitId:'u'}))};
 const catalog=referenceCatalog(detail,'u');assert.equal(catalog.length,2);
 const result=analyzeBindings({}, {videoPrompt:'张三站立。'},catalog);
 assert.deepEqual(result.assets,[]);assert.equal(result.issues.length,1);
});

test('F13 an explicit resolvedAssetId removes only the candidate proven to be the confirmed identity',()=>{
 const detail={assets:[role('real','张三')],assetCandidates:[
  {id:'resolved',name:'张三',category:'character',status:'pending_confirmation',unitId:'u',resolvedAssetId:'real'},
  {id:'other',name:'张三',category:'character',status:'pending_confirmation',unitId:'u'},
 ]};
 assert.deepEqual(referenceCatalog(detail,'u').map(a=>a.id),['real','candidate:other']);
});

test('clear confirmed assets still receive real version bindings with no pending candidate IDs',()=>{
 const detail={assets:[role('a','张三'),role('b','李四')],assetCandidates:[]};
 const row=prepareShotRows([{revision:{videoPrompt:'张三走向门口，李四不出场。'}}],detail,'u')[0];
 assert.deepEqual(row.assetVersionIds,['v-a']);assert.ok(row.revision.videoPrompt.includes('@[asset:a]'));
 assert.ok(!row.revision.videoPrompt.includes('@[asset:b]'));
});
