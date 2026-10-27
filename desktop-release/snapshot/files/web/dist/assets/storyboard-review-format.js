import{completePrompt}from './storyboard-detail-contract.js';
const flatten=v=>typeof v==='string'?v:Array.isArray(v)?v.map(flatten).join('；'):v&&typeof v==='object'?Object.values(v).map(flatten).join('；'):String(v??'');
const cells=['左前','正前','右前','左中','中心','右中','左后','正后','右后'];
// Review display only: preserve model values and never silently repair timing.
export function formatReviewSegment(segment,source){
 const d=segment,names=[...new Set([d.scene,...d.visibleAssets||[]].filter(Boolean))],pattern=names.slice().sort((a,b)=>b.length-a.length).map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),ref=v=>pattern?flatten(v).replace(new RegExp('@?(?:'+pattern+')','g'),m=>'@'+m.replace(/^@/,'')):flatten(v);
 const assetLines=(d.assetDescriptions||[]).map(a=>`${a.category==='character'?'人物':a.category==='environment'?'场景':'道具'} @${a.name}：${ref(a.description||a.environment)}`);
 const sections=[['角色固定音色锁',d.voiceLock],['关键点前缀',d.style],['全局执行规则',d.rules],['画面约束（按需靶向约束）',d.constraints],['特殊触发状态',d.trigger],['上段继承状态锁',d.inherit],['场景、空间站位、体态死锁与按需激活模块总设计',d.spatial],['场景九宫格',(d.grid||[]).map((v,i)=>cells[i]+'：'+ref(v)).join('；')],['BGM与跨Seq音频DNA无缝锁总设计',`BGM：${d.audio?.bgm||'待复核'}；BPM：${d.audio?.bpm||'待复核'}；环境底噪：${d.audio?.ambient||'待复核'}；对白闪避：${d.audio?.ducking||'待复核'}；首尾衔接：${d.audio?.transition||'待复核'}`]];
 let main=names.map(n=>`(@${n} 是${n})`).join('；')+'；本Seq场景为@'+d.scene+'。\n\n【本段人物、场景与道具】\n'+assetLines.join('\n')+'\n\n'+sections.map(([k,v])=>`【${k}】：${ref(v)||'此项未返回，待人工复核'}`).join('\n')+'\n';let sum=0,dialogue='';
 for(let i=0;i<(d.shots||[]).length;i++){
  const t=d.shots[i],start=sum;sum=Math.round((sum+Number(t.duration))*1000)/1000;const spoken=(t.voices||[]).map(v=>{const s=source.speeches[v.speechId-1];dialogue+=v.text;return`台词及固定音色/呼吸留白：${s?.speaker||'待核对发声者'}（${s?.mode!=='对白'||v.onScreen===false?'画外音':'对白'}）：${v.text}`;}).join('\n')||'台词及固定音色/呼吸留白：无配音，保留环境声';
  main+=`镜头${i+1}（预估本镜：${Number(t.duration).toFixed(1)}秒 ｜ 本Seq累加: 约${sum.toFixed(1)}秒）：\n【全息周边环境、光源投影、坐标体态锁、180度轴线站位与机位俯视图】：\n┌────────────────────────────────────────┐\n${(d.grid||[]).map((v,j)=>'│ '+cells[j]+'：'+ref(v)+' │').join('\n')}\n│ 🎥 ${ref(t.camera)} ↑ │\n│ 💡 ${ref(t.lighting)} │\n└────────────────────────────────────────┘\n【分镜详情】：\n🎥 机位与构图：${ref(t.camera)}\n💡 光影与环境：${ref(t.lighting)}\n🎭 表演与防穿帮：${ref(t.performance)}\n【逐轮对话与动作承接】\n${start.toFixed(1)}—${sum.toFixed(1)}秒：${ref(t.performance)}\n${spoken}\n🔊 声效：${ref(t.sound)}\n`;
 }
 main+=`【段尾视觉、坐标体态、轴线与状态锁】：${ref(d.endVisual)}\n【段尾音频DNA与系统状态锁】：${ref(d.endAudio)}`;
 return{prompt:completePrompt(main),dialogue,duration:Math.round(sum*1000),firstFrame:ref(d.firstFrame),description:`未通过验收，供人工复核；${d.scene}`,title:`待复核 ${d.id}`};
}
