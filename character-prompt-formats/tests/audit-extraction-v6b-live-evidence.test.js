import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {parseExtractionJSON} from '../src/extraction-recovery.js';
import {validateSourceInventory,validateVisualProvenance} from '../src/extraction-source-inventory.js';
test('real v6b Gemini returned four arrays and linked every independent asset to true source quotes',()=>{
 const root=new URL('../../影策审计-20261025/',import.meta.url);
 const data=JSON.parse(fs.readFileSync(new URL('repair-live-extraction-v6b-gemini-3.1-pro-preview-original.assets.json',root),'utf8'));
 const variables=JSON.parse(fs.readFileSync(new URL('repair-live-extraction-v6b-inputs.json',root),'utf8')).labeled;
 assert.equal(validateSourceInventory(data,variables).mappedAssetCount,5);assert.equal(validateVisualProvenance(data).assetCount,5);
 assert.ok(data.props.some(p=>p.name==='木桌'));assert.ok(data.characters.every(c=>c.personality==='正文未明确'));
});
test('previous actual v6 failure remains rejected for missing wire contract rather than retroactively counted passed',()=>{
 const root=new URL('../../影策审计-20261025/',import.meta.url);
 const text=fs.readFileSync(new URL('repair-live-extraction-v6-gemini-3.1-pro-preview-original.content.txt',root),'utf8');
 const data=parseExtractionJSON(text);
 assert.throws(()=>validateSourceInventory(data,{'章节正文':'林岚'}),/要求顶层sourceInventory/);
});
