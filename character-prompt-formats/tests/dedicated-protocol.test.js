import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
test('dedicated local protocol survives separately from official and declares real request flags',()=>{
 const data=path.join(process.env.LOCALAPPDATA,'YingceCanvas/data');const registry=JSON.parse(fs.readFileSync(path.join(data,'plugin_registry.json'),'utf8').replace(/^\uFEFF/,''));
 const item=registry.find(x=>x.id==='yingce-asset-json');assert.ok(item);assert.equal(item.source,'local');assert.ok(registry.some(x=>x.id==='a6api'));
 const bytes=fs.readFileSync(path.join(data,'plugin-packages',item.packagePath));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),item.packageSha256);
 const provider=item.manifest.contributes.providers[0];assert.equal(provider.id,'yingce-asset-json-chat');assert.equal(provider.create.body.stream,false);assert.deepEqual(provider.create.body.response_format.$coalesce[1],{type:'json_object'});assert.equal(provider.create.body.response_format.$coalesce[0].$ref,'request.providerOptions.yingce-asset-json-chat.response_format');assert.equal(provider.create.body.thinking.$omitEmpty.$ref,'request.providerOptions.yingce-asset-json-chat.thinking');
});
