import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('../src/skill-runtime-CF8drDK4.js',import.meta.url),'utf8');
const body=src.slice(src.indexOf('function i('),src.indexOf('var S,C,w,T,E,D='));
const api=new Function('r','n',body+`;let S={shortDrama:{delivery:'linked-context',maxSkills:4,maxContextChars:32000,maxLinkedFilesPerSkill:3},canvas:{delivery:'linked-context',maxSkills:4,maxContextChars:32000,maxLinkedFilesPerSkill:3}};let C=/@\\[skill:([^\\]]+)\\]/g;let w=new Set(['.md','.txt','.json']);let T={skillIds:[],skillVersions:[],skillFiles:[]};return {s};`)(()=>{},()=>{});
const skill={skillId:'test',skillName:'测试技能',isAdded:true,versionId:'v1',version:'1'};
function runtime(main,files={}){return api.s({getFile:async(id,path)=>({file:{binary:false,content:path==='SKILL.md'?main:files[path],file:{sha256:'hash'}}}),listFiles:async()=>({files:['SKILL.md',...Object.keys(files)].map(path=>({path,kind:'text'}))})});}
const prepare=(r,profile='shortDrama')=>r.prepare({profile,prompt:'生成分镜',skills:[skill],selectedSkillIds:['test']});
test('F16 loads every required file, with the three-file limit applying only to optional references',async()=>{
 const files=Object.fromEntries(['a','b','c','d'].map(n=>['references/'+n+'.md','完整说明']));
 const result=await prepare(runtime('先读取 '+Object.keys(files).join(' 和 ')+'。',files));
 assert.deepEqual(result.metadata.skillFiles.map(f=>f.path),['SKILL.md',...Object.keys(files)]);
 for(const path of Object.keys(files))assert.ok(result.prompt.includes(`<skill-file path="${path}">\n完整说明\n</skill-file>`));
});

test('F16 loads required references first and caps only optional references at three',async()=>{
 const required=Object.fromEntries(['a','b','c','d'].map(n=>['references/'+n+'.md','必读内容']));
 const optional=Object.fromEntries(['w','x','y','z'].map(n=>['references/'+n+'.md','可选内容']));
 const main='必须读取 '+Object.keys(required).join(' 和 ')+'。\n可选分镜参考：'+Object.keys(optional).join('、')+'。';
 const result=await prepare(runtime(main,{...required,...optional}));
 const paths=result.metadata.skillFiles.map(f=>f.path);
 assert.equal(paths.length,8);for(const path of Object.keys(required))assert.ok(paths.includes(path));
 assert.equal(paths.filter(p=>Object.hasOwn(optional,p)).length,3);
});

test('F16 multiple required files cannot exceed the unchanged per-skill shared budget',async()=>{
 const files={'references/a.md':'甲'.repeat(17000),'references/b.md':'乙'.repeat(17000)};
 await assert.rejects(prepare(runtime('必须读取 references/a.md 和 references/b.md。',files)),/超过剩余/);
 const second={...skill,skillId:'second'};
 await assert.rejects(runtime('必须读取 references/a.md。',{'references/a.md':'长'.repeat(17000)}).prepare({profile:'shortDrama',prompt:'分镜',skills:[skill,second],selectedSkillIds:['test','second']}),/超过剩余/);
});
test('F16 refuses a truncated main or required reference',async()=>{
 await assert.rejects(prepare(runtime('长'.repeat(33000))),/主文件超过/);
 await assert.rejects(prepare(runtime('必须读取 references/a.md。',{'references/a.md':'长'.repeat(33000)})),/超过剩余/);
});
test('F17 text host capability is explicit while canvas workflow context remains available',async()=>{
 const r=runtime('根据事实编写分镜。');const result=await prepare(r);
 assert.ok(result.prompt.includes('不是Agent工具会话'));assert.equal(result.metadata.skillToolExecution,false);assert.equal(result.metadata.skillFiles[0].path,'SKILL.md');
 const canvas=await prepare(r,'canvas');assert.ok(!canvas.prompt.includes('本轮是章节分镜的单次文本生成'));
});
