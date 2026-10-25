import test from 'node:test';import assert from 'node:assert/strict';
import {validateScenePromptSections} from '../src/extraction-source-inventory.js';
import {extractionOutputExample} from '../src/extraction-contract-builder.js';
test('complete scene example preserves all twelve required administrator sections',()=>{assert.equal(validateScenePromptSections(extractionOutputExample()).status,'scene-sections-present');});
test('missing duplicate and empty 3.5 section rejects; legacy stays compatible',()=>{
 const original=extractionOutputExample();
 for(const prompt of [original.scenes[0].prompt.replace(/\[3\.5[^\n]+\n/,''),original.scenes[0].prompt+'\n[3.5动态元素隔离]无人物',original.scenes[0].prompt.replace(/(\[3\.5[^\]]+\])[^\n]+/,'$1同上')])assert.throws(()=>validateScenePromptSections({scenes:[{name:'测试',prompt}]}),/第3.5节/);
 assert.equal(validateScenePromptSections({scenes:[{name:'旧场景',prompt:'单段旧场景'}]},{contractVersion:5}).status,'legacy-unchecked');
});
