import fs from 'node:fs';import path from 'node:path';
const file=path.join(process.env.LOCALAPPDATA,'YingceCanvas/versions/1.3.13/web/dist/assets/skill-runtime-CF8drDK4.js');const src=fs.readFileSync(file,'utf8');
const body=src.slice(src.indexOf('function i('),src.indexOf('var S,C,w,T,E,D='));
const api=new Function('r','n',body+`;let S={shortDrama:{delivery:'linked-context',maxSkills:4,maxContextChars:32000,maxLinkedFilesPerSkill:3}};let C=/@\\[skill:([^\\]]+)\\]/g;let w=new Set(['.md','.txt','.json']);let T={skillIds:[],skillVersions:[],skillFiles:[]};return {i,s,u};`)(()=>{},()=>{});
const calls=[];const skills=Array.from({length:5},(_,i)=>({skillId:'s'+i,skillName:'技能'+i,isAdded:true,version:'1',versionId:'v'+i}));
const runtime=api.s({getFile:async(id,p)=>{calls.push({id,path:p});return{file:{binary:false,content:p==='SKILL.md'?'先读取 references/a.md 和 references/b.md 和 references/c.md 和 references/d.md。必须读取 backend/internal/prompts/AGENTS.md。':'参考内容',file:{sha256:'test'}}}},listFiles:async()=>({files:['SKILL.md','references/a.md','references/b.md','references/c.md','references/d.md'].map(path=>({path,kind:'text'}))})});
const result=await runtime.prepare({profile:'shortDrama',prompt:'生成分镜',skills,selectedSkillIds:skills.map(s=>s.skillId)});
const report={selectedRequested:5,selectedActual:result.selectedSkills.length,linkedPathsForFirst:calls.filter(c=>c.id==='s0').map(c=>c.path),requiresMissingSystemContract:result.prompt.includes('必须读取 backend/internal/prompts/AGENTS.md'),promptContainsSystemContractBody:false};
fs.writeFileSync(new URL('./skill-probe-results.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
