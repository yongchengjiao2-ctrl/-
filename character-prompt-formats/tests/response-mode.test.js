import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {extractionStream,RESPONSE_MODE_KEY} from '../src/extraction-response-mode.js';
test('defaults to non-stream; choice persists; unavailable storage remains non-stream',()=>{
 assert.equal(extractionStream({getItem:()=>null}),false);
 assert.equal(extractionStream({getItem:key=>{assert.equal(key,RESPONSE_MODE_KEY);return 'complete'}}),false);
 assert.equal(extractionStream({getItem:()=> 'stream'}),true);
 assert.equal(extractionStream({getItem:()=>{throw Error('blocked')}}),false);
});
test('installed request builder forwards explicit false into task textOptions.stream',()=>{
 const assets=path.join(process.env.LOCALAPPDATA,'YingceCanvas/versions/1.3.13/web/dist/assets');
 const generation=fs.readFileSync(path.join(assets,'generation-task-B2p8YPAC.js'),'utf8');
 const expression=generation.match(/textOptions:\{stream:(e\.streamText!==!1),thinking:e\.enableThinking===!0\}/);
 assert.ok(expression,'actual request builder forwards streamText');
 const evaluate=new Function('e','return '+expression[1]);
 assert.equal(evaluate({streamText:false}),false);assert.equal(evaluate({streamText:true}),true);
 const chapter=fs.readFileSync(path.join(assets,'chapters-CeKTBaiU.js'),'utf8');
 assert.ok(chapter.includes('RFRequestExtraction'));
 const runtime=fs.readFileSync(path.join(assets,'asset-extraction-runtime-v3.js'),'utf8');assert.ok(runtime.includes('streamText:false'));
 assert.ok(!fs.readFileSync(path.join(assets,'character-prompt-formats.js'),'utf8').includes('h(ResponseModePicker'));
});

test('real canvas wrapper preserves explicit non-stream flag',async()=>{
 const assets=path.join(process.env.LOCALAPPDATA,'YingceCanvas/versions/1.3.13/web/dist/assets');
 const text=fs.readFileSync(path.join(assets,'canvas-project-generation-DKqeyZxD.js'),'utf8');
 const fn=text.slice(text.indexOf('async function H({'),text.indexOf('function U(e,t)'));
 const wrapper=new Function('de','oe',fn+';return H')(()=>{},args=>args);
 const passed=await wrapper({projectId:'test',mode:'text',streamText:false,prompt:'test',config:{}});
 assert.equal(passed.streamText,false);
});
