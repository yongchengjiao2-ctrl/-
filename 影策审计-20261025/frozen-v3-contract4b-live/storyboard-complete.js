// Only chapter storyboard generation uses these settings. No global model changes.
import {DEFAULT_STORYBOARD_RULES} from './storyboard-template-standard.js';
import {DETAIL_RULES} from './storyboard-detail-contract.js';
import {normalizeDetailedRows,assertDetailedRows} from './storyboard-detail-normalize.js';
import {assertSourceFidelity} from './source-script-contract.js';
import {textRequestPolicy,textRequestMetadata} from './text-request-policy.js';
export const STORYBOARD_PROTOCOL='yingce-asset-json-chat';
export const COMPLETE_RULES=`
【一次完整返回】本次使用非流式JSON，完整生成所有rows后一次返回。不要输出续传标记、解释或省略号代替内容。
【引用合同】assetBindings使用目录中实际nodeId及role；正文使用目录中独立标注的@[asset:assetId]，nodeId与assetId不可混用。待确认素材只用@实际名称，不虚构绑定ID。每段按实际可见内容引用人物、场景、道具。
【配音校对】仅对白和旁白属于配音；场景标题、人物名单和画面描述不能放进dialogue。逐字保持所有原有配音及顺序，跨段只在自然语义处切分，合并全部dialogue必须与配音原文一致。dialogue不加说话人或旁白标签。
【时长校对】每行1至15秒；内部镜头标签累计时间须等于durationSeconds，每段从镜头1及累计0重新开始。不增加台词、不省略剧情。
【完整字段】每行包含shotNumber、durationSeconds、plotDescription、dialogue、characters、narrativeIntent、viewerPOV、performanceBlocking、shotSize、emotion、lightingAndAtmosphere、audioEffects、camera、motion、timeBeats、imageGenerationPrompt、videoMotionPrompt、continuityOut、negativePrompt、mustHave、optionalDetails、assetBindings。characters是{characterName,characterAssetId}对象数组，待确认角色省略characterAssetId。绑定不能超过9项。
【精确输出】只输出一个有效JSON对象{title,rows}。videoMotionPrompt按所选模板组织；其它解释字段简明填写，避免重复长篇描述。配音、素材目录与剧情必须完整覆盖。素材中的示例、技能中的工作流说明都不能替换本次输出合同。
`;
export function completeSystemPrompt(existing=''){return [existing,'你负责生成完整可保存的分镜数据。以下是本次必须执行的输出合同。',COMPLETE_RULES,DEFAULT_STORYBOARD_RULES,DETAIL_RULES].filter(Boolean).join('\n\n');}
export function completeOptions(model){
 return {stream:false,response_format:{type:'json_object'},max_tokens:65536,...model.toLowerCase().includes('deepseek')?{thinking:{type:'disabled'}}:{}};
}
export function completeConfig(config){
 return {...textRequestPolicy(config).config,systemPrompt:completeSystemPrompt(config.systemPrompt)};
}
export function completeMetadata(modelOrConfig){return {storyboardResponseVersion:2,storyboardTemplateVersion:'1.2.0',...(typeof modelOrConfig==='object'?textRequestMetadata(modelOrConfig):{responseMode:'non-stream',requestedStream:false,providerOptions:{[STORYBOARD_PROTOCOL]:completeOptions(modelOrConfig)}})};}
export function validateStoryboardRows(rows,catalog,source=''){
 const result=assertDetailedRows(normalizeDetailedRows(rows,catalog));
 assertSourceFidelity(result,source);
 return result;
}
export function catalogRules(assets=[]){return '\n【本次素材引用目录】\n'+JSON.stringify(assets.map(a=>({nodeId:a.pending?undefined:a.id,assetId:a.pending?undefined:a.id,name:a.title,category:a.category,pending:!!a.pending,reference:a.pending?'@'+a.title:`@[asset:${a.id}]`})))+'\n已确认人物以characterAssetId=assetId绑定；场景role=environment，道具role=prop，人物role=character；待确认素材不进入assetBindings。';}
export function outputGuide(assets=[]){
 const refs=['character','environment','prop'].map(category=>assets.find(a=>a.category===category)).filter(Boolean).map(a=>a.pending?'@'+a.title:`@[asset:${a.id}]`).join('、');
 return `\n【最后核对：videoMotionPrompt的强制版式】不能只写“0-3秒”或“景别与运镜”简表。每行正文必须包含以下栏目，栏目值由本段剧情填写，不能省略为“同上”：
素材介绍（本段可见人物/道具），本Seq场景为（本段场景）。可用真实引用写法示例：${refs}。只示范写法，不要求每镜出现这些素材。
【角色固定音色锁】\n【关键点前缀】\n【全局执行规则】\n【画面约束（按需靶向约束）】\n【特殊触发状态】\n【上段继承状态锁】\n【场景、空间站位、体态死锁与按需激活模块总设计】\n【场景九宫格】\n【BGM与跨Seq音频DNA无缝锁总设计】
镜头1（预估本镜：实际秒数秒 ｜ 本Seq累加: 约实际累计秒数秒）：
【全息周边环境、光源投影、坐标体态锁、180度轴线站位与机位俯视图】\n【分镜详情】\n🎥 机位与构图：\n💡 光影与环境：\n🎭 表演与防穿帮：\n💬 台词：\n🔊 声效：
有后续切镜则按相同格式递增镜头编号、填写单镜秒数及累计秒数；本段末次累计必须等于durationSeconds。
【段尾视觉、坐标体态、轴线与状态锁】\n【段尾音频DNA与系统状态锁】\n【一键复制AI视频纯享提示词（纯净高权重安全版）】
本段所有可见素材在开头、正文和空间图均使用目录规定的@引用，不能只在characters和assetBindings里填ID而正文不带@。保留整个JSON的连续shotNumber，不能按场次重置。最终只返回包含完整title和rows的JSON对象，不加代码围栏。`+DETAIL_RULES;
}
export async function waitComplete(id,{queryTask,initialTask,onTaskUpdate,signal,intervalMs=2000}){
 let task=initialTask;
 for(;;){
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  if(task){
   // Never forward intermediate text to the chapter view.
   const {textDraft,...status}=task;onTaskUpdate?.(status);
   if(task.status==='succeeded')return task;
   if(task.status==='failed'||task.status==='cancelled')throw Error(task.error||'分镜任务未完成');
  }
  await new Promise((resolve,reject)=>{
   const done=()=>{signal?.removeEventListener('abort',abort);resolve();};
   const timer=setTimeout(done,intervalMs);
   const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(new DOMException('Aborted','AbortError'));};
   signal?.addEventListener('abort',abort,{once:true});
  });
  task=await queryTask(id,{signal});
 }
}
