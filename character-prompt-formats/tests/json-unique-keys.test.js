import test from 'node:test';
import assert from 'node:assert/strict';
import {parseUniqueKeys} from '../src/json-unique-keys.js';
test('conflicting and identical duplicate values are rejected before silent overwrite',()=>{
 for(const text of ['{"style":"a","style":"b"}','{"end":1,"end":1}','{"a":[{"voice":"x","voice":"y"}]}'])assert.throws(()=>parseUniqueKeys(text),/重复字段/);
});
test('escaped equivalent keys are duplicates; separate object fields are valid',()=>{
 assert.throws(()=>parseUniqueKeys('{"a":1,"\\u0061":2}'),/重复字段/);
 assert.deepEqual(parseUniqueKeys('{"a":[{"end":1},{"end":2}],"end":3}'),{a:[{end:1},{end:2}],end:3});
});
test('quoted punctuation and value strings cannot alter object scopes',()=>{
 const value={a:'{},"a":1',b:['a','a',{a:'a'}],c:{a:'a'}};
 assert.deepEqual(parseUniqueKeys(JSON.stringify(value)),value);
 assert.throws(()=>parseUniqueKeys('{"a":1,}'),SyntaxError);
});
