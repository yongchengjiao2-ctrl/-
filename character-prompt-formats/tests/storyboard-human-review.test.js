import test from'node:test';import assert from'node:assert/strict';import{reviewIssues,keepReviewDraft}from'../src/storyboard-human-review.js';import{generatePlannedChapter}from'../src/storyboard-planned-runtime-audit-v3.js';
test('missing sections list the exact source words and retain every original character',()=>{
 const issues=reviewIssues({segments:[]},{segments:[{id:2,voice:'原台词不能丢',shots:[]}]},Error('缺段'));assert.ok(issues.some(x=>x.includes('第2段')&&x.includes('原台词不能丢')));
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},text='模型原始输出，包括不完整JSON { ';
 const saved=keepReviewDraft({projectId:'p',chapterId:'u'},text,issues,storage);assert.equal(saved.text,text);assert.equal(saved.persisted,true);assert.equal(JSON.parse(data.values().next().value)[0].text,text);
});
test('storage capacity/corruption keeps existing drafts unchanged and reports memory-only output',()=>{
 for(const existing of ['not json',JSON.stringify(Array.from({length:100},(_,i)=>({id:i,text:'old'})))]){let writes=0;const draft=keepReviewDraft({projectId:'p2',chapterId:'c2'},'new raw',['issue'],{getItem:()=>existing,setItem:()=>writes++});assert.equal(draft.persisted,false);assert.equal(draft.text,'new raw');assert.equal(writes,0);assert.ok(draft.storageError);}
});
test('abort while waiting for an asynchronous review rejects without a retry request',async()=>{
 const controller=new AbortController();let calls=0,resolveReview;
 const pending=generatePlannedChapter({projectId:'abort-review',chapterId:'c',screenplayText:'场景：仓库\n△画面：门关闭。',config:{model:'m',channels:[{id:'t',models:['m'],interfaceType:'a6api-chat'}]}},{signal:controller.signal},{prepare:async p=>({...p,metadata:{}}),textConfig:c=>c,createTask:async()=>{calls++;return{id:'t',status:'succeeded',resultJson:'{"text":"{}"}'}},reviewStorage:{getItem:()=>null,setItem:()=>{}},reviewDraft:()=>new Promise(r=>{resolveReview=r;controller.abort();})});
 await assert.rejects(pending,{name:'AbortError'});resolveReview('retry');await Promise.resolve();assert.equal(calls,1);
});
test('acknowledgment never starts another API request; retry starts exactly one only after review decision',async()=>{
 let calls=0,reviews=0;const store=new Map();const deps={prepare:async p=>({...p,metadata:{}}),textConfig:c=>c,createTask:async()=>{calls++;return{id:'t'+calls,status:'succeeded',resultJson:JSON.stringify({text:'{"title":"不完整","segments":[]}'})}},queryTask:async()=>{throw Error('unexpected polling')},reviewStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},reviewDraft:async draft=>{reviews++;assert.equal(calls,reviews);assert.ok(draft.text.includes('不完整'));return reviews===1?'retry':'ack';}};
 await assert.rejects(generatePlannedChapter({projectId:'review-test',chapterId:'chapter',screenplayText:'场景：仓库\n人物：甲\n△画面：甲站在门口。\n甲：开门。',config:{model:'m',channels:[{id:'test',models:['m'],interfaceType:'a6api-chat'}]}},{},deps),/待复核草稿/);assert.equal(calls,2);assert.equal(reviews,2);assert.equal(JSON.parse(store.values().next().value).length,2);
});
