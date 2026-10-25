import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const assets=path.join(process.env.LOCALAPPDATA,'YingceCanvas/versions/1.3.13/web/dist/assets');
const s=fs.readFileSync(path.join(assets,'canvas-character-reference-qPZJkX1a.js'),'utf8');
const parse=new Function(s.slice(s.indexOf('function s(e)'),s.indexOf('var p=e('))+';return f')();
const raw=fs.readFileSync(new URL('../build/recovered-dual.final.json',import.meta.url),'utf8');
test('actual recovered dual response keeps nine distinct roles despite shared crowd aliases',()=>{assert.equal(parse(raw).length,9);const v=JSON.parse(raw);v.characters.push(v.characters[0]);assert.equal(parse(JSON.stringify(v)).length,9)});
test('shared extraction runtime replaces fragment continuation and forces non-stream',()=>{const s=fs.readFileSync(path.join(assets,'asset-extraction-runtime-v3.js'),'utf8');assert.ok(!s.includes('chapter-assets-continuation'));assert.ok(s.includes('streamText:false'));assert.ok(s.includes('attempt<2'))});
