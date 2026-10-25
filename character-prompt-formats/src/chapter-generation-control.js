const terminal=new Set(['succeeded','failed','cancelled']);
const keyFor=(projectId,chapterId)=>JSON.stringify([String(projectId),String(chapterId)]);
async function cancelBackendTask(taskId){
 const {i:initialize,t:cancel}=await import('./task-center-CCDONRL0.js');
 initialize();return cancel(taskId);
}

// This only controls the current chapter's generation. Task persistence,
// provider cancellation and cancellation events remain owned by task-center.
export function createChapterGenerationRegistry({cancelTask=cancelBackendTask}={}){
 const records=new Map(),listeners=new Set();let sequence=0;
 const emit=()=>{for(const listener of listeners)listener();};
 const locate=handle=>records.get(handle.key)?.generation===handle.generation?records.get(handle.key):null;
 const snapshot=record=>record?Object.freeze({projectId:record.projectId,chapterId:record.chapterId,generation:record.generation,phase:record.phase,taskId:record.taskId,status:record.status,cancelRequested:record.cancelRequested,cancelling:!!record.cancelPromise,error:record.error,providerCancelStatus:record.providerCancelStatus,active:record.active}):null;
 const update=(handle,task)=>{
  const record=locate(handle);if(!record||!task)return;
  if(task.id&&record.retiredTaskIds.has(task.id))return;
  if(record.taskId&&task.id&&record.taskId!==task.id)return;
  if(terminal.has(record.status)&&task.status!==record.status)return;
  const lateSubmission=record.phase==='stopped-before-submit'&&task.id&&!terminal.has(task.status);
  if(task.id)record.taskId=task.id;
  if(typeof task.status==='string')record.status=task.status;
  record.providerCancelStatus=task.providerCancelStatus||record.providerCancelStatus;
  if(terminal.has(record.status)){
   record.phase=record.status;record.active=false;record.error=record.status==='failed'?(task.error||'任务失败'):'';
   // An HTTP response to /cancel alone is not proof. Only the confirmed task
   // terminal status cancels local polling; provider status stays separate.
   if(record.status==='cancelled')record.controller.abort();
  }else{record.active=true;record.phase=record.cancelRequested?'cancelling':'running';}
  emit();
  // A create request may already be in flight when the local preparation is
  // stopped. If its task ID arrives later, cancel the real task rather than
  // leaving an orphan or retaining the earlier “not submitted” status.
  if(lateSubmission)cancel(record.projectId,record.chapterId).catch(()=>{});
 };
 const start=(projectId,chapterId)=>{
  const key=keyFor(projectId,chapterId),existing=records.get(key);
  if(existing?.active)throw Error('本章仍有分镜任务，先等待完成或确认取消后再生成。');
  const record={key,projectId,chapterId,generation:++sequence,controller:new AbortController(),phase:'preparing',taskId:null,status:null,cancelRequested:false,error:'',providerCancelStatus:'',active:true,cancelPromise:null,callFinished:false,retiredTaskIds:new Set()};
  const handle={key,generation:record.generation,signal:record.controller.signal,onTaskUpdate:task=>update(handle,task),beginRetry:()=>beginRetry(handle),finish:error=>finish(handle,error)};
  record.handle=handle;records.set(key,record);emit();return handle;
 };
 const beginRetry=handle=>{
  const record=locate(handle);
  if(!record||record.callFinished||record.controller.signal.aborted||!record.taskId||!terminal.has(record.status)||record.cancelPromise)throw Error('当前任务不能开始重试；仅允许用户明确选择后对已结束任务重试。');
  record.retiredTaskIds.add(record.taskId);record.taskId=null;record.status=null;record.providerCancelStatus='';record.cancelRequested=false;record.error='';record.phase='preparing';record.active=true;emit();
 };
 const finish=(handle,error)=>{
  const record=locate(handle);if(!record)return;
  record.callFinished=true;
  if(error&&error.name!=='AbortError')record.error=error.message||String(error);
  if(record.taskId&&!terminal.has(record.status)){
   // The frontend may lose contact while the backend is still running. Keep
   // its task and cancellation affordance visible instead of claiming done.
   record.active=true;record.phase=record.cancelRequested?'cancelling':'running';
  }else if(!record.taskId&&record.phase!=='stopped-before-submit'){
   record.active=false;record.phase=error?'failed':'finished';
  }
  emit();
 };
 const cancel=(projectId,chapterId)=>{
  const record=records.get(keyFor(projectId,chapterId));
  if(!record||!record.active)return Promise.resolve(snapshot(record));
  if(record.cancelPromise)return record.cancelPromise;
  record.error='';record.cancelRequested=true;
  if(!record.taskId){
   record.controller.abort();record.active=false;record.phase='stopped-before-submit';emit();
   return Promise.resolve(snapshot(record));
  }
  record.phase='cancelling';
  const handle=record.handle;
  const promise=Promise.resolve().then(()=>cancelTask(record.taskId)).then(task=>{
   if(!task||typeof task.status!=='string')throw Error('取消请求未返回有效任务状态，请在创作历史核对。');
   update(handle,task);return snapshot(locate(handle));
  }).catch(error=>{
   const current=locate(handle);
   if(current&&!terminal.has(current.status)){current.error=error.message||String(error);current.cancelRequested=false;current.phase='running';emit();}
   throw error;
  }).finally(()=>{const current=locate(handle);if(current){current.cancelPromise=null;emit();}});
  record.cancelPromise=promise;emit();return promise;
 };
 return {start,update,finish,cancel,get:(projectId,chapterId)=>snapshot(records.get(keyFor(projectId,chapterId))),subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);}};
}

export const chapterGenerationRegistry=createChapterGenerationRegistry();
export const beginChapterGeneration=(projectId,chapterId)=>chapterGenerationRegistry.start(projectId,chapterId);
const reportKey=(projectId,chapterId)=>`yingce-storyboard-generation-report:${projectId}:${chapterId}`;
export function saveChapterGenerationReport(projectId,chapterId,report,storage=globalThis.localStorage){
 try{storage?.setItem(reportKey(projectId,chapterId),JSON.stringify({...report,createdAt:new Date().toISOString()}));return true;}catch{return false;}
}
export function readChapterGenerationReport(projectId,chapterId,storage=globalThis.localStorage){
 try{return JSON.parse(storage?.getItem(reportKey(projectId,chapterId))||'null');}catch{return null;}
}
export function ChapterGenerationControl({react:React,projectId,chapterId,registry=chapterGenerationRegistry}){
 const [,rerender]=React.useState(0);
 React.useEffect(()=>registry.subscribe(()=>rerender(n=>n+1)),[registry]);
 const state=registry.get(projectId,chapterId);
 if(!state)return null;
 const h=React.createElement;
 const report=state.status==='succeeded'?readChapterGenerationReport(projectId,chapterId):null;
 const text=state.phase==='stopped-before-submit'?'已停止准备；未创建模型任务。':state.status==='cancelled'?'后端已确认任务取消。':state.status==='succeeded'?'模型任务已返回；可解析的分镜会直接保存，原文及格式差异只在报告中提示。':state.status==='failed'?'任务失败。':state.phase==='cancelling'?'已请求取消，正在等待后端确认。':state.taskId?'本章分镜任务正在运行。':'正在准备本章分镜任务。';
 return h('section',{'aria-label':'本章分镜任务控制',style:{display:'grid',gap:6,marginTop:8}},
  h('p',{role:'status',style:{margin:0,fontSize:12}},text),
  state.active?h('button',{type:'button',disabled:state.cancelling||state.cancelRequested,onClick:()=>{registry.cancel(projectId,chapterId).catch(()=>{});}},state.cancelRequested?'等待取消确认…':'取消本次分镜任务'):null,
  state.status==='cancelled'&&state.providerCancelStatus?h('p',{style:{margin:0,fontSize:12}},`供应商取消状态：${state.providerCancelStatus}`):null,
  report?h('div',{role:'status',style:{fontSize:12,lineHeight:1.7,padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:8}},
   h('strong',null,report.issues?.length?`生成差异报告（${report.issues.length}项，结果已保存）`:'生成差异报告：未发现差异，结果已保存'),
   report.issues?.length?h('ul',{style:{margin:'4px 0 0',paddingLeft:20}},...report.issues.map((issue,i)=>h('li',{key:i},issue))):null):null,
  state.error?h('p',{role:'alert',style:{margin:0,fontSize:12,color:'#dc2626'}},state.error):null);
}
