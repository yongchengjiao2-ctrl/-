import test from 'node:test';import assert from 'node:assert/strict';
import {attachExtractionReview,prepareCandidates,provenancePanel,extractionReviewLabel} from '../src/asset-provenance.js';
const jsx={jsx:(type,props)=>({type,...props}),jsxs:(type,props)=>({type,...props})};
test('v5 partial coverage survives three-array projection, candidate preparation and JSON serialization',()=>{
 const data=attachExtractionReview({characters:[{name:'林岚'}],scenes:[],props:[],coverageAssessment:{status:'unverified',reason:'普通小说待核对',checkedScopes:[]}});
 const projected={characters:data.characters,scenes:data.scenes,props:data.props};
 const candidates=prepareCandidates(projected.characters.map(a=>({name:a.name,category:'character',status:'pending_confirmation',unitId:'u',details:{...a}})),[{id:'u',title:'1'}]);
 const saved=JSON.parse(JSON.stringify(candidates))[0];assert.equal(saved.details.extractionReview.status,'unverified');assert.equal(saved.details.extractionReview.requiresHumanReview,true);assert.match(JSON.stringify(provenancePanel(saved,[],jsx)),/提取结果待人工核对/);
});
test('only locally validated inventory report is trusted, and same name in another category does not cross-bind',()=>{
 const base={characters:[{name:'钥匙',visualProvenance:{sourceFacts:['事实'],suggestions:['建议']}}],scenes:[],props:[{name:'钥匙'}],sourceInventory:[{kind:'character',name:'伪造',quote:'不可信'}],coverageAssessment:{status:'labeled-partial',checkedScopes:['people','props'],sourceInventory:{status:'self-inventory-linked',spans:[{kind:'prop',assetName:'钥匙',quote:'铜钥匙',occurrence:1,start:3,end:6}]},visualProvenance:{status:'provenance-declared'}}};
 const data=attachExtractionReview(base);assert.equal(data.characters[0].extractionReview.sourceQuotes.length,0);assert.equal(data.props[0].extractionReview.sourceQuotes[0].quote,'铜钥匙');assert.equal(data.characters[0].extractionReview.visualProvenance.sourceFactCount,1);
 const raw=attachExtractionReview({...base,coverageAssessment:{status:'unverified'}});assert.equal(raw.props[0].extractionReview.sourceQuotes.length,0);assert.equal(raw.characters[0].extractionReview.visualProvenance.status,'not-declared');
});
test('confirmed and resolved assets are never downgraded or given pending warnings',()=>{
 const data=attachExtractionReview({characters:[{name:'甲',status:'confirmed'}],scenes:[],props:[],coverageAssessment:{status:'unverified'}});
 assert.equal(data.characters[0].status,'confirmed');
 const confirmed={name:'甲',status:'confirmed',category:'character',details:data.characters[0]};
 assert.equal(extractionReviewLabel(confirmed),'');assert.ok(!JSON.stringify(provenancePanel(confirmed,[],jsx)).includes('待人工核对'));
 assert.equal(extractionReviewLabel({...confirmed,status:'pending_confirmation',resolvedAssetId:'real'}),'');
});
test('old data without report is explicitly unverified without fabricated source or altering input',()=>{
 const original={characters:[{name:'甲'}],scenes:[],props:[]},before=JSON.stringify(original),data=attachExtractionReview(original);
 assert.equal(JSON.stringify(original),before);assert.equal(data.characters[0].extractionReview.status,'unverified');assert.deepEqual(data.characters[0].extractionReview.sourceQuotes,[]);assert.match(data.characters[0].extractionReview.limitations,/不证明.*穷尽/);
});
