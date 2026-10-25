import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=n=>JSON.parse(fs.readFileSync(new URL('../build/storyboard-test/'+n,import.meta.url),'utf8'));
test('three real DeepSeek stop responses are still rejected when their content is truncated',()=>{
 for(const run of ['deepseek-1','deepseek-v2-1','deepseek-3']){
  const response=read(run+'.response.json'),report=read(run+'.report.json');assert.equal(response.choices[0].finish_reason,'stop');assert.throws(()=>JSON.parse(response.choices[0].message.content),SyntaxError);assert.equal(report.validated,false);
 }
});
test('real final Gemini response is complete JSON with template and all three reference categories',()=>{
 const response=read('gemini-format-2.response.json'),data=JSON.parse(response.choices[0].message.content),report=read('gemini-format-2.report.json');
 assert.equal(data.rows.length,10);assert.equal(report.narrationExact,true);assert.equal(report.installedParserPassed,true);assert.equal(report.renderedReferenceCheckPassed,true);assert.equal(report.validated,true);
 for(const category of ['character','environment','prop'])assert.ok(report.referenceCounts[category]>0);
 assert.ok(data.rows.every(r=>r.videoMotionPrompt.includes('角色固定音色锁')));
});
