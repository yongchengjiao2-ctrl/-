import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {prepareShotRows,bindPrompt,referenceCatalog,inferBindings} from '../src/shot-asset-bindings.js';
const d=JSON.parse(fs.readFileSync(new URL('../build/current-binding-input.json',import.meta.url),'utf8'));
test('current ten shots get intros and tokens for visible assets, pending IDs never used as real IDs',()=>{
 const rows=d.shots.map(s=>({...s,revision:d.shotRevisions.find(r=>r.shotId===s.id)}));
 const out=prepareShotRows(rows,d,d.shots[0].unit_id);
 assert.equal(out.length,10);
 for(const row of out){assert.ok(row.revision.videoPrompt.includes(' 是'));assert.ok(row.revision.videoPrompt.includes('@'));assert.ok(!row.revision.videoPrompt.includes('@[asset:candidate:'));}
 assert.ok(out[0].revision.videoPrompt.includes('@天津学生代表群体'));
 assert.ok(out[0].revision.videoPrompt.includes('@声援北京旗帜'));
 assert.ok(!out[0].revision.videoPrompt.includes('是欢迎群众与学生'));
 // This historical fixture contains a confirmed 周恩来 and a distinct unresolved
 // same-name candidate. Do not choose either identity from list order.
 assert.ok(out[1].revision.videoPrompt.includes('素材引用待核对'));
 assert.ok(out[1].assetVersionIds.every(id=>!id.startsWith('candidate:')));
});
test('literal-only mention of unconfirmed asset remains a placeholder, confirmed asset uses real token',()=>{
 const detail={assets:[{id:'zhao',title:'赵慎行',category:'character',primaryVersionId:'v-zhao'}],assetCandidates:[{id:'horse',name:'黑马',category:'character',status:'pending_confirmation'},{id:'sword',name:'斩佞刀',category:'prop',status:'pending_confirmation'},{id:'camp',name:'三王兵马驻扎处营外荒野',category:'environment',status:'pending_confirmation'}]};
 const row=prepareShotRows([{description:'赵慎行骑黑马，手持斩佞刀，站在三王兵马驻扎处营外荒野',revision:{videoPrompt:'画面：赵慎行骑黑马，手持斩佞刀。场景：三王兵马驻扎处营外荒野。'}}],detail)[0];
 assert.deepEqual(row.assetVersionIds,['v-zhao']);assert.ok(row.revision.videoPrompt.includes('@[asset:zhao]'));assert.ok(row.revision.videoPrompt.includes('@黑马 是黑马，待确认素材'));assert.ok(row.revision.videoPrompt.includes('@斩佞刀'));assert.ok(row.revision.videoPrompt.includes('@三王兵马驻扎处营外荒野'));
});
test('narration alone does not bind a visible character; repeated repair is stable',()=>{
 const assets=[{id:'zhao',title:'赵慎行',category:'character',primaryVersionId:'v-zhao'}];
 assert.equal(inferBindings({}, {videoPrompt:'旁白：赵慎行抵达。'},assets).length,0);
 const text=bindPrompt('画面：赵慎行站立。',assets);assert.equal(bindPrompt(text,assets),text);
});

test('model-declared character without any asset gets a named placeholder and no fake binding',()=>{
 const row=prepareShotRows([{referenceHints:['三王千夫长','尚武军兵卒'],revision:{videoPrompt:'画面：三王千夫长带领尚武军兵卒前进。'}}],{assets:[],assetCandidates:[]})[0];
 assert.ok(row.revision.videoPrompt.includes('@三王千夫长 是三王千夫长，待确认素材'));
 assert.ok(row.revision.videoPrompt.includes('@尚武军兵卒'));
 assert.deepEqual(row.assetVersionIds,[]);assert.equal(row.referenceHints,undefined);
});
