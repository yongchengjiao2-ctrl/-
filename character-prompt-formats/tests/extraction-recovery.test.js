import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const assets=path.join(process.env.LOCALAPPDATA,'YingceCanvas/versions/1.3.13/web/dist/assets');
const parser=fs.readFileSync(path.join(assets,'canvas-character-reference-qPZJkX1a.js'),'utf8');
const functions=parser.slice(parser.indexOf('function s(e)'),parser.indexOf('var p=e('));
const {parse,characters}=new Function(functions+';return {parse:d,characters:f}')();
const read=id=>fs.readFileSync(new URL('../build/result-'+id+'.txt',import.meta.url),'utf8');
test('both falsely successful responses are truncated JSON and rejected',()=>{
 for(const id of ['70802a1272733fb2483f18ee9ceacc2d','4f25036035cd04bcafb1f1fa4afc76c2']){
  assert.throws(()=>JSON.parse(read(id)));assert.throws(()=>parse(read(id),true));
 }
});
test('recovered original response passes the real app contract for all 19 assets',()=>{
 const text=read('221e5dd846ffcc7544a8cfc4fa4b8ec2'),data=parse(text,true);
 assert.equal(characters(text).length,10);
 for(const key of ['scenes','props'])for(const item of data[key])for(const field of ['name','description','prompt'])assert.ok(typeof item[field]==='string'&&item[field].trim());
 assert.equal(data.scenes.length,4);assert.equal(data.props.length,5);
});
