import pathlib,os,json,hashlib
root=pathlib.Path(__file__).parent;assets=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/versions/1.3.13/web/dist/assets'
p=assets/'chapters-CeKTBaiU.js';s=p.read_text('utf8');before=s
old='async function bn(e,t){return RFPlannedChapter(e,t,{prepare:x=>Tt.prepare(x),createTask:lt,queryTask:ot,textConfig:it})}'
new='async function bn(e,t){let control=RFAuditBeginChapter(e.projectId,e.chapterId),failure;try{return await RFPlannedChapter(e,{...t,signal:control.signal,onTaskUpdate:task=>{control.onTaskUpdate(task);t?.onTaskUpdate?.(task)}},{prepare:x=>Tt.prepare(x),createTask:lt,queryTask:ot,textConfig:it})}catch(error){failure=error;throw error}finally{control.finish(failure)}}'
assert s.count(old)==1;s=s.replace(old,new,1)
old=']})]}),Bt?';new=']})]}),(0,$.jsx)(RFAuditChapterControl,{react:Q,projectId:e.project.id,chapterId:V.id}),Bt?'
assert s.count(old)==1;s=s.replace(old,new,1)
s='import{beginChapterGeneration as RFAuditBeginChapter,ChapterGenerationControl as RFAuditChapterControl}from"./chapter-generation-control.js";'+s
# Clarify that parsing candidates does not establish complete semantic extraction.
s=s.replace('角色、场景与道具可在“角色与资产”中查看和确认。','角色、场景与道具候选已保存，请逐项核对原文遗漏、身份与造型建议后确认。')
(root.parent/'character-prompt-formats/src/chapters-CeKTBaiU.js').write_text(s,encoding='utf8')
(root/'chapter-control-baseline.json').write_text(json.dumps({'file':p.name,'beforeSha256':hashlib.sha256(before.encode()).hexdigest(),'afterSha256':hashlib.sha256(s.encode()).hexdigest()},indent=2),encoding='utf8')
print('Prepared chapter task controls; not installed')
