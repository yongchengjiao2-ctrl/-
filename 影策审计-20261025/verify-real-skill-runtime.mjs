import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const base=new URL('./',import.meta.url),pkg=JSON.parse(fs.readFileSync(new URL('F16-真实ZIP文件.json',base),'utf8'));
const src=fs.readFileSync(new URL('../character-prompt-formats/src/skill-runtime-CF8drDK4.js',base),'utf8'),body=src.slice(src.indexOf('function i('),src.indexOf('var S,C,w,T,E,D='));
const factory=new Function('r','n',body+`;let S={shortDrama:{delivery:'linked-context',maxSkills:4,maxContextChars:32000,maxLinkedFilesPerSkill:3},canvas:{delivery:'linked-context',maxSkills:4,maxContextChars:32000,maxLinkedFilesPerSkill:3}};let C=/@\\[skill:([^\\]]+)\\]/g;let w=new Set(['.md','.mdx','.txt','.json','.yaml','.yml','.toml','.csv']);let T={skillIds:[],skillVersions:[],skillFiles:[]};return {s,u};`)(()=>{},()=>{});
const files=Object.keys(pkg.files).map(path=>({path,kind:'text'})),skill={skillId:pkg.id,skillName:pkg.name,isAdded:true,versionId:pkg.version_id,version:pkg.version_label};
const request=JSON.parse(fs.readFileSync(new URL('repair-live-storyboard-request.json',base),'utf8')),prompt=request.messages.find(m=>m.role==='user').content;
const report={newProviderCalls:0,packageKey:pkg.package_key,zipSHA256:pkg.zip_sha256,skillVersion:pkg.version_label,budgetChars:32000,optionalFileLimit:3,runtimeSHA256:crypto.createHash('sha256').update(src).digest('hex'),profiles:{},allPackageSources:[]};
for(const profile of ['shortDrama','canvas']){
 const reads=[];
 const runtime=factory.s({getFile:async(id,path)=>{reads.push(path);const f=pkg.files[path];assert.ok(f,'missing package file '+path);return{file:{binary:false,content:f.content,file:{sha256:f.sha256}}}},listFiles:async()=>({files})});
 const prepared=await runtime.prepare({profile,prompt,skills:[skill],selectedSkillIds:[skill.skillId]});
 assert.ok(prepared.metadata.skillFiles.length>4,'required dependencies were still capped');
 const injectedChars=prepared.metadata.skillFiles.reduce((n,f)=>n+pkg.files[f.path].content.length,0);assert.ok(injectedChars<=32000);
 for(const file of prepared.metadata.skillFiles)assert.ok(prepared.prompt.includes(pkg.files[file.path].content),'truncated '+file.path);
 report.profiles[profile]={accepted:true,reads,injectedChars,metadata:prepared.metadata,hostBoundaryPresent:prepared.prompt.includes('不是Agent工具会话')};
}
const eligible=factory.u(pkg.files['SKILL.md'].content,files,prompt);
report.allPackageSources=files.map(({path})=>({path,chars:pkg.files[path].content.length,sha256:pkg.files[path].sha256,selected:report.profiles.shortDrama.reads.includes(path),required:eligible.some(f=>f.path===path&&f.required),reason:path==='SKILL.md'?'entry':eligible.some(f=>f.path===path)?'required or relevant reference':'not an explicit relevant full path in entry'}));
// Capacity control only: use the real 14 ZIP texts, with a synthetic main that
// explicitly marks every reference required. This does not modify the library
// skill or claim those extra files were selected by the actual entry.
const allPaths=files.map(f=>f.path).filter(p=>p!=='SKILL.md'),controlMain=pkg.files['SKILL.md'].content+'\n必须读取 '+allPaths.join(' 和 ')+'。';
const allRuntime=factory.s({getFile:async(id,path)=>({file:{binary:false,content:path==='SKILL.md'?controlMain:pkg.files[path].content,file:{sha256:pkg.files[path].sha256}}}),listFiles:async()=>({files})});
const capacity=await allRuntime.prepare({profile:'shortDrama',prompt,skills:[skill],selectedSkillIds:[skill.skillId]});
assert.equal(capacity.metadata.skillFiles.length,14);
const allChars=controlMain.length+allPaths.reduce((n,p)=>n+pkg.files[p].content.length,0);assert.ok(allChars<=32000);
report.allRequiredCapacityControl={accepted:true,syntheticMainOnly:true,sourceFileCount:14,injectedChars:allChars,paths:capacity.metadata.skillFiles.map(f=>f.path)};
fs.writeFileSync(new URL('F16-真实ZIP运行验证.json',base),JSON.stringify(report,null,2));console.log(JSON.stringify({profiles:Object.fromEntries(Object.entries(report.profiles).map(([k,v])=>[k,{accepted:v.accepted,files:v.reads.length,injectedChars:v.injectedChars}])),allRequiredCapacityControl:report.allRequiredCapacityControl},null,2));
