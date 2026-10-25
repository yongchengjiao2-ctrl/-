import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_FORMATS,readSettings,loadManagedFormats,TEMPLATE_OPERATIONS,CharacterFormatPicker} from '../src/character-prompt-formats.js';
test('local edits are ignored; selection survives',()=>{
 const settings=readSettings({getItem:()=>JSON.stringify({selected:'four-panel',formats:DEFAULT_FORMATS.map(f=>({...f,content:'tampered'}))})});
 assert.equal(settings.selected,'four-panel');assert.deepEqual(settings.formats,DEFAULT_FORMATS);
});
test('server edits are read for all three formats',async()=>{
 const rows=DEFAULT_FORMATS.map(f=>({operation:TEMPLATE_OPERATIONS[f.id],enabled:true,name:f.name,version:9,content:'managed '+f.id}));
 const formats=await loadManagedFormats(async()=>({templates:rows}));
 assert.equal(formats[1].content,'managed four-panel');assert.equal(formats[1].version,9);assert.ok(formats.every(f=>f.locked));
 await assert.rejects(loadManagedFormats(async()=>({templates:rows.slice(1)})),/后台未启用/);
});
test('picker exposes selection only',()=>{
 const source=CharacterFormatPicker.toString();
 for(const text of ['textarea','导入','导出','保存新版本','格式提示词'])assert.ok(!source.includes(text));
});

test('actual desktop preferences envelope resolves three managed templates',async()=>{
 const {readFileSync}=await import('node:fs');
 const actual=JSON.parse(readFileSync(new URL('../build/managed-verify/catalog-actual.json',import.meta.url),'utf8'));
 const formats=await loadManagedFormats(async()=>actual.data);
 assert.equal(formats.length,3);
 assert.deepEqual(formats.map(f=>f.id),['original','four-panel','side-portrait']);
 assert.ok(formats.every(f=>f.content.includes('characters')&&f.content.includes('scenes')&&f.content.includes('props')));
});
