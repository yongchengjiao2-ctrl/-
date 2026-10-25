import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {parseExtractionJSON}from '../src/extraction-recovery.js';
test('real missing props is rejected without silently substituting an empty array',()=>{
 const s=fs.readFileSync(new URL('../build/latest-576e3e1c20ce55642005627d2f194e87.json',import.meta.url),'utf8');assert.throws(()=>parseExtractionJSON(s),/props必须为数组/);
});
test('real four-panel missing opening quote is repaired without losing any fields',()=>{
 const s=fs.readFileSync(new URL('../build/latest-785a64a90d76bf6377d9670064e4fe22.json',import.meta.url),'utf8');const data=parseExtractionJSON(s);assert.ok(data.characters.length);assert.ok(data.scenes.length);assert.ok(data.props.length);assert.ok(data.characters.some(c=>c.name.includes('军警')&&typeof c.consistencyPrompt==='string'));
});
