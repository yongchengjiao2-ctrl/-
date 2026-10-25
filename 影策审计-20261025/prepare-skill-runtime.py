import pathlib,os
root=pathlib.Path(__file__).parent.parent/'character-prompt-formats'
p=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/versions/1.3.13/web/dist/assets/skill-runtime-CF8drDK4.js'
s=p.read_text('utf8')
def once(old,new):
 global s
 if s.count(old)!=1:raise RuntimeError('Skill patch anchor changed: '+old[:70])
 s=s.replace(old,new,1)
once('if(a.file.binary)throw Error(', 'if(a.file.binary)throw Error(') # guard
once('let s=n,c=p(a.file.content,s);','if(a.file.content.length>n)throw Error(`技能「${e.skillName}」主文件超过本轮上下文预算，未完整应用；请减少技能数量。`);let s=n,c=p(a.file.content,s);')
once('let d=u(a.file.content,o.files,t).slice(0,r),f=await Promise.all(d.map(t=>i.getFile(e.skillId,t.path)));',
 'let eligible=u(a.file.content,o.files,t);if(eligible.filter(x=>x.required).length>r)throw Error(`技能「${e.skillName}」必读文件超过${r}个，本轮未完整应用；请使用适配此宿主的技能。`);let d=eligible.slice(0,r),f=await Promise.all(d.map(t=>i.getFile(e.skillId,t.path)));')
once('if(n.file.binary)continue;let r=p(n.file.content,s);',
 'if(n.file.binary){if(t.required)throw Error(`技能必读文件${t.path}不是文本，无法完整应用`);continue;}if(t.required&&n.file.content.length>s)throw Error(`技能必读文件${t.path}超过剩余上下文预算，未完整应用`);let r=p(n.file.content,s);')
once('if(s<=0||r<=0)return{skill:e,files:l};', 'if(s<=0||r<=0){if(u(a.file.content,o.files,t).some(x=>x.required))throw Error(`技能「${e.skillName}」没有剩余预算读取必读文件，未完整应用`);return{skill:e,files:l};}')
once('e<d.length&&!(s<=0);','e<d.length;')
# The runtime is a text-context preparer, not an Agent tool executor.
once('return a.prepare({prompt:_(e.prompt,e.skills),selectedSkills:r,config:n})',
 'let prepared=await a.prepare({prompt:_(e.prompt,e.skills),selectedSkills:r,config:n});if(e.profile===`shortDrama`)prepared={...prepared,prompt:prepared.prompt+`\\n【当前宿主能力】本轮是章节分镜的单次文本生成，不是Agent工具会话。Skill中的工具调用、审批、表单、媒体生成与交付流程仅供背景参考，本轮不执行、不声称已执行；只采用与当前分镜有关的领域规则，最终严格返回宿主指定JSON合同，不输出暂停、工具请求或全流程状态表。`,metadata:{...prepared.metadata,skillHost:`shortDrama-text`,skillToolExecution:false}};return prepared')
(root/'src/skill-runtime-CF8drDK4.js').write_text(s,encoding='utf8');print('Prepared Skill runtime in source only; no installation')
