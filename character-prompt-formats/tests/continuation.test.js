import test from 'node:test';
import assert from 'node:assert/strict';
import {unfinishedJSON,completeExtraction} from '../src/extraction-recovery.js';
test('continues exactly at a cut inside an escaped JSON string',async()=>{
 const data={characters:[{name:'周恩来',prompt:'完整设定\\"继续'}],scenes:[],props:[]};
 const full=JSON.stringify(data),cut=full.indexOf('继续')+1;let calls=0;
 const text=await completeExtraction(full.slice(0,cut),{validate:JSON.parse,request:async(prefix)=>{calls++;assert.equal(prefix,full.slice(0,cut));return full.slice(cut)}});
 assert.deepEqual(JSON.parse(text),data);assert.equal(calls,1);
});
test('does not make extra calls for complete JSON or closed malformed JSON',async()=>{
 const request=()=>{throw Error('must not call')};
 assert.equal(await completeExtraction('{"characters":[]}',{validate:JSON.parse,request}),'{"characters":[]}');
 await assert.rejects(completeExtraction('{"characters":,}',{validate:JSON.parse,request}));
 assert.equal(unfinishedJSON('{"x":]}'),false);
});
test('bounds empty and repeated truncation failure',async()=>{
 await assert.rejects(completeExtraction('{"x":"',{validate:JSON.parse,request:async()=>''}),/空内容/);
 let count=0;await assert.rejects(completeExtraction('{"x":"',{validate:JSON.parse,maxContinuations:2,request:async()=>{count++;return '更多'}}),/多次截断/);assert.equal(count,2);
});
