import test from 'node:test';import assert from 'node:assert/strict';import {copyMentionSelection,mentionPlainText} from '../src/mention-clipboard.js';
const text=s=>({nodeType:3,textContent:s}),chip=id=>({nodeType:1,nodeName:'SPAN',dataset:{mentionToken:`@[asset:${id}]`},childNodes:[{nodeType:1,nodeName:'IMG',childNodes:[]}]});
test('image-only chips retain readable @ names in introductions and spatial diagrams',()=>{
 const root={childNodes:[text('('),chip('student'),text(' 是天津学生代表)；\n│ '),chip('student'),text(' 汇聚 ↑ 🎥 │')]};
 assert.equal(mentionPlainText(root,[{assetId:'student',label:'天津学生代表'}]),'(@天津学生代表 是天津学生代表)；\n│ @天津学生代表 汇聚 ↑ 🎥 │');
 assert.equal(mentionPlainText(chip('unknown')),'@[asset:unknown]');
});
test('copy handler preserves only the selected range, not the whole editor',()=>{
 let value,prevented=false;const node=text('select');const root={contains:n=>n===node,ownerDocument:{defaultView:{getSelection:()=>({rangeCount:1,isCollapsed:false,getRangeAt:()=>({startContainer:node,endContainer:node,cloneContents:()=>({childNodes:[chip('scene'),text(' 冬日')]})})})}}};
 const ok=copyMentionSelection({clipboardData:{setData:(mime,s)=>{assert.equal(mime,'text/plain');value=s}},preventDefault:()=>prevented=true},root,[{assetId:'scene',title:'天津街头'}]);
 assert.equal(ok,true);assert.equal(prevented,true);assert.equal(value,'@天津街头 冬日');
});
