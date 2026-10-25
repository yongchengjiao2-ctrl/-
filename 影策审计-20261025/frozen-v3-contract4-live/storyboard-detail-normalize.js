import {bindPrompt,analyzeBindings}from './shot-asset-bindings.js';
import {completePrompt,mainPrompt,auditDetailed}from './storyboard-detail-contract.js';
import {materializeSpatialDiagrams}from './storyboard-spatial-render.js';
export function normalizeDetailedRows(rows,catalog){
 const key=s=>String(s||'').replace(/[\s《》〈〉「」『』【】\[\]（）()、，,:：。;；\-—_]/g,'').toLowerCase();
 return rows.map(row=>{
  const additions=(row.referenceInfo||[]).filter(r=>!catalog.some(a=>key(a.title)===key(r.name))).map(r=>({id:'unresolved:'+r.name,title:r.name,category:r.category,pending:true,definition:{description:r.description}}));
  const local=[...catalog,...additions];
  if(String(row.videoMotionPrompt||'').includes('【素材引用待核对】'))throw Error('分镜存在未解决的素材引用歧义，请明确实际素材身份并移除待核对标记后再保存。');
  const explicit=new Set((row.assetBindings||[]).map(b=>b.nodeId||b.assetId||b.characterAssetId).filter(id=>local.some(a=>!a.pending&&a.id===id)));
  for(const c of row.characters||[])if(local.some(a=>!a.pending&&a.category==='character'&&a.id===c.characterAssetId))explicit.add(c.characterAssetId);
  for(const m of String(row.videoMotionPrompt||'').matchAll(/@\[asset:([^\]]+)\]/g))if(local.some(a=>!a.pending&&a.id===m[1]))explicit.add(m[1]);
  const aliases=a=>{let d=a.character?.definition||a.definition||{};if(typeof d==='string'){try{d=JSON.parse(d)}catch{d={}}}return [a.title,a.originalTitle,...(Array.isArray(d.aliases)?d.aliases:[])].filter(Boolean);};
  const candidatesFor=(name,category)=>local.filter(a=>(!category||a.category===category)&&aliases(a).some(n=>key(n)===key(name)));
  const choose=(candidates,label)=>{
   const unique=[...new Map(candidates.map(a=>[a.id,a])).values()];
   if(unique.length===1)return unique[0];
   const selected=unique.filter(a=>explicit.has(a.id));
   if(selected.length===1)return selected[0];
   if(unique.length>1)throw Error(`素材引用歧义：“${label}”对应多个素材（${unique.map(a=>a.title).join('、')}），请指定唯一的实际素材ID。`);
  };
  row=Object.fromEntries(Object.entries(row).map(([field,value])=>[field,typeof value==='string'&&field!=='dialogue'?catalog.filter(a=>a.originalTitle).reduce((s,a)=>s.split(a.originalTitle).join(a.title),value):value]));
  const repairedIds=new Map();
  const characters=(row.characters||[]).map(c=>{
   let actual=local.find(a=>!a.pending&&a.category==='character'&&a.id===c.characterAssetId);
   const named=candidatesFor(c.characterName,'character');
   if(actual&&named.length&&!named.some(a=>a.id===actual.id))throw Error(`角色ID与名称冲突：“${c.characterName}”不是所指定素材“${actual.title}”。`);
   actual=actual||choose(named,c.characterName);
   if(actual&&!actual.pending&&c.characterAssetId&&actual.id!==c.characterAssetId)repairedIds.set(c.characterAssetId,actual.id);
   if(actual&&!actual.pending)explicit.add(actual.id);
   return actual&&!actual.pending?{...c,characterAssetId:actual.id}:{characterName:c.characterName};
  });
  let text=mainPrompt(row.videoMotionPrompt).replace(/@\[asset:([^\]]+)\]/g,(all,id)=>repairedIds.has(id)?`@[asset:${repairedIds.get(id)}]`:all);
  text=text.replace(/@(?!\[asset:)([^\s；;│\n]+)/g,(all,name)=>{const actual=choose(candidatesFor(name),name);return actual?(actual.pending?'@'+actual.title:`@[asset:${actual.id}]`):all;});
  const analysis=analyzeBindings({description:row.plotDescription},{videoPrompt:text},local),inferred=[...analysis.assets];
  for(const issue of analysis.issues){const actual=choose(issue.candidates.map(c=>local.find(a=>a.id===c.id)).filter(Boolean),issue.name);if(actual)inferred.push(actual);}
  const visible=local.filter(a=>explicit.has(a.id)||inferred.some(b=>b.id===a.id));
  const bindings=visible.filter(a=>!a.pending).map(a=>({nodeId:a.id,role:a.category,priority:100}));
  let main=bindPrompt(text,visible);
  const titles={'角色固定音色锁':'角色固定音色锁','关键点前缀':'关键点前缀','全局执行规则':'全局执行规则','画面约束':'画面约束（按需靶向约束）','特殊触发状态':'特殊触发状态','上段继承状态锁':'上段继承状态锁','场景、空间站位':'场景、空间站位、体态死锁与按需激活模块总设计','场景九宫格':'场景九宫格','BGM与跨Seq':'BGM与跨Seq音频DNA无缝锁总设计','全息周边环境':'全息周边环境、光源投影、坐标体态锁、180度轴线站位与机位俯视图','分镜详情':'分镜详情','段尾视觉':'段尾视觉、坐标体态、轴线与状态锁','段尾音频':'段尾音频DNA与系统状态锁'};
  main=main.replace(/【([^】]+)】/g,(all,title)=>{const name=title.replace(/[,，]\s*/g,'、'),prefix=Object.keys(titles).find(k=>name.startsWith(k));return prefix?'【'+titles[prefix]+'】':all;});
  main=main.replace(/(镜头\s*\d+[^\n]*\n)(?=┌)/g,'$1【全息周边环境、光源投影、坐标体态锁、180度轴线站位与机位俯视图】：\n');
  return {...row,characters,assetBindings:bindings,videoMotionPrompt:completePrompt(materializeSpatialDiagrams(main))};
 });
}
export function assertDetailedRows(rows){
 const errors=rows.flatMap((r,i)=>auditDetailed(r,{requireCopy:true}).map(e=>`第${i+1}段：${e}`));
 if(errors.length)throw Error('分镜正文未完整通过校验：'+errors.slice(0,8).join('；'));return rows;
}
