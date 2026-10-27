import{formatReviewSegment}from './storyboard-review-format.js';
import{directorSource,directorPrompt,directorResponseFormat,renderDirector}from './storyboard-autonomous-director.js';
import{reviewIssues,keepReviewDraft,showReviewDraft}from './storyboard-human-review.js';
import{parsePlannedText,packedV2PlanScript,legacyPlanScript,planScript,plannedPrompt,renderPlanned,plannedResponseFormat}from './storyboard-planned.js';
import{completeConfig,completeMetadata,waitComplete}from './storyboard-complete.js';
import{oneChapterSubmission,makeSingleModelTask}from './storyboard-single-call.js';
import{auditDetailed}from './storyboard-detail-contract.js';
import{textRequestPolicy,textRequestMetadata}from './text-request-policy.js';
import{saveChapterGenerationReport}from './chapter-generation-control.js';
export function recoverPlannedTask(task){
 const metadata=JSON.parse(task.inputJson||'{}').metadata||{},payload=JSON.parse(task.resultJson||'{}');
 const text=typeof payload.text==='string'?payload.text:JSON.stringify(payload.text||payload);
 const raw=parsePlannedText(text);
 if(metadata.storyboardPlanVersion===4)return renderDirector(raw,directorSource(metadata.expectedScreenplayText||metadata.narrationSource||''));
 const plan=(metadata.storyboardPlanVersion===1?legacyPlanScript:metadata.storyboardPlanVersion===2?packedV2PlanScript:planScript)(metadata.expectedScreenplayText||metadata.narrationSource||'');
 const result=renderPlanned(raw,plan,{contentContract:metadata.plannedContentContract||0}),errors=result.rows.flatMap((r,i)=>auditDetailed(r,{requireCopy:true}).map(s=>`第${i+1}段：${s}`));
 if(errors.length)throw Error('恢复的分镜导演内容未通过校验：'+errors.slice(0,6).join('；'));
 return result;
}
export async function generatePlannedChapter(e,callbacks={},deps){
 const signal=callbacks.signal||e.signal;
 for(;;){try{return await generateAttempt(e,callbacks,deps);}catch(error){
  if(!error.reviewDraft)throw error;
  const decide=deps.reviewDraft||(typeof document!=='undefined'?showReviewDraft:null);
  if(!decide)throw error;
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  const choice=await new Promise((resolve,reject)=>{let settled=false;const done=(fn,value)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);fn(value);};const abort=()=>done(reject,new DOMException('Aborted','AbortError'));signal?.addEventListener('abort',abort,{once:true});Promise.resolve().then(()=>decide(error.reviewDraft,{signal})).then(v=>done(resolve,v),e=>done(reject,e));});
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  if(choice==='retry'){await callbacks.onReviewRetry?.();if(signal?.aborted)throw new DOMException('Aborted','AbortError');continue;}
  const held=new Error(error.reviewDraft.persisted?'当前输出已保存在本机待复核草稿，现有分镜未替换。':'当前输出未能保存到本机，请下载或复制当前原始输出；现有分镜未替换。');held.reviewDraft=error.reviewDraft;throw held;
 }}
}
async function generateAttempt(e,callbacks={},deps){
 return oneChapterSubmission('model:'+e.projectId+':'+e.chapterId,async()=>{
  const signal=callbacks.signal||e.signal;
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  const plan=directorSource(e.screenplayText||e.sourceText),model=e.config.textModel||e.config.model;
  const config={...completeConfig({...e.config,model,textModel:model}),systemPrompt:'你是影视导演。自主分析完整剧本并决定切镜、段数、镜头数、台词分配及秒数。segments每项是一张外层分镜卡/Seq，非末尾卡目标12至15秒且原则上不少于10秒；shots才是卡内2至5秒的短切镜。原文镜头编号不是外层卡边界。逐字保留原文配音。不得套用固定镜头数量清单，一次返回完整导演JSON。'};
  const context=await deps.prepare({profile:'shortDrama',prompt:directorPrompt(plan,e.projectStyle,e.referenceCatalog||e.assets),skills:e.skills,selectedSkillIds:e.selectedSkillIds});
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  const policy=textRequestPolicy(config,{responseFormat:directorResponseFormat()});
  const metadata={...completeMetadata(config),...textRequestMetadata(config,{responseFormat:directorResponseFormat()})};
  const task=await makeSingleModelTask(deps.createTask)({projectId:e.projectId,type:'canvas_text',operation:'text',prompt:context.prompt,model,input:{mode:'text',config:deps.textConfig(policy.config,'text'),textOptions:{stream:false,thinking:false},metadata:{domainProjectId:e.projectId,chapterId:e.chapterId,source:'short-drama-chapter-storyboard-preview',expectedShotIds:e.expectedShotIds,expectedSourceText:e.expectedSourceText,expectedScreenplayText:e.screenplayText,narrationSource:e.sourceText,storyboardSource:e.sourceMode,maxSegmentSeconds:15,...context.metadata,...metadata,storyboardPlanVersion:4,directorChoosesShots:true,lockedVoice:plan.voice}}});
  callbacks.onTaskUpdate?.(task);
  const final=await waitComplete(task.id,{initialTask:task,queryTask:deps.queryTask,onTaskUpdate:callbacks.onTaskUpdate,signal:callbacks.signal||e.signal});
  const payload=JSON.parse(final.resultJson||'{}'),text=typeof payload.text==='string'?payload.text:JSON.stringify(payload.text||payload);
  let raw;try{raw=parsePlannedText(text);
  const result=renderDirector(raw,plan),formatIssues=result.rows.flatMap((r,i)=>auditDetailed(r,{requireCopy:true}).map(s=>`第${i+1}段：${s}`));
  const auditReport={status:result.auditReport?.issues?.length||formatIssues.length?'有差异，已直接保存':'与原文及格式要求一致',issues:[...new Set([...(result.auditReport?.issues||[]),...formatIssues])]};
  saveChapterGenerationReport(e.projectId,e.chapterId,auditReport,deps.reportStorage);
  return {...result,auditReport,skillCount:context.selectedSkills?.length||0};
  }catch(error){error.reviewDraft=keepReviewDraft(e,text,reviewIssues(raw,plan,error),deps.reviewStorage);
   try{if(raw?.segments?.length)error.reviewDraft.displayText=raw.segments.map(s=>formatReviewSegment(s,plan).prompt).join("\n\n──────────\n\n");}catch{}throw error;}
 });
}
