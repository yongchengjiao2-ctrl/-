export const IDENTITY_RULES=`\n【资产身份与造型来源】每个角色（包括生物）、场景、道具增加identityName、entityType、variantName三个字符串字段。identityName是稳定的原文主体名称，不附加章节、状态或服装后缀；entityType为character、creature、environment或prop。variantName只有正文明确出现不同服装、年龄阶段、形态、场景时段/破坏状态、道具外形/状态时才填写简洁准确标签，否则填空字符串。同一主体只有措辞、动作、情绪、镜头、所选绘图版式不同，不算新造型。群像不同阵营、地点不同空间、同名但身份不同的主体不能合并。使用提供的已有身份目录统一姓名和已知别名，不能把另一个具名人物写入aliases。`;
const clean=s=>String(s||'').normalize('NFKC').trim();
export const identityKey=s=>clean(s).replace(/[\s·•・《》〈〉「」『』【】\[\]（）()、，,:：。;；\-—_]/g,'').toLocaleLowerCase();
export function preserveIdentity(parsed,raw){
 return parsed.map(a=>{const r=raw.find(r=>clean(r?.name)===clean(a.name))||{};return {...a,...Object.fromEntries(['identityName','entityType','variantName'].filter(k=>typeof r[k]==='string').map(k=>[k,r[k]]))};});
}
export function assertIdentityFields(data){
 for(const [key,types]of [['characters',['character','creature']],['scenes',['environment']],['props',['prop']]])for(const a of data[key]){
  if(typeof a.identityName!=='string'||!a.identityName.trim())throw Error(`${a.name}缺少稳定主体名称identityName`);
  if(!types.includes(a.entityType))throw Error(`${a.name}的entityType必须为${types.join('/')}`);
  if(typeof a.variantName!=='string')throw Error(`${a.name}缺少variantName；没有明确造型变化时必须填空字符串`);
 }
}
export function stampSourceTask(data,taskId){
 if(!taskId)return data;
 return {...data,...Object.fromEntries(['characters','scenes','props'].map(k=>[k,data[k].map(a=>({...a,extractionSourceTaskId:taskId}))]))};
}
export function attachExtractionReview(data){
 const coverage=data?.coverageAssessment;
 const checked=Array.isArray(coverage?.checkedScopes)?coverage.checkedScopes.filter(s=>['people','scenes','props'].includes(s)):[];
 const inventory=coverage?.sourceInventory;
 const spans=inventory?.status==='self-inventory-linked'&&Array.isArray(inventory.spans)?inventory.spans:[];
 const visualVerified=coverage?.visualProvenance?.status==='provenance-declared';
 return {...data,...Object.fromEntries([['characters','character'],['scenes','environment'],['props','prop']].map(([key,kind])=>[key,(data[key]||[]).map(asset=>{
  if(!coverage&&asset.extractionReview)return {...asset};
  const names=new Set([asset.name,asset.identityName].filter(Boolean).map(clean));
  const sourceQuotes=spans.filter(s=>s.kind===kind&&names.has(clean(s.assetName))&&typeof s.quote==='string'&&s.quote.trim()&&Number.isInteger(s.start)&&s.start>=0&&Number.isInteger(s.end)&&s.end>s.start).map(s=>({quote:s.quote,occurrence:s.occurrence,start:s.start,end:s.end,unit:s.unit||'utf16-code-unit'}));
  const vp=asset.visualProvenance;
  return {...asset,extractionReview:{schemaVersion:1,requiresHumanReview:true,status:['unverified','labeled-partial'].includes(coverage?.status)?coverage.status:'unverified',reason:coverage?.reason||'旧结果缺少覆盖核验报告，来源与完整性待人工核实。',checkedScopes:checked,sourceQuotes,visualProvenance:{status:visualVerified&&vp?'provenance-declared':'not-declared',sourceFactCount:visualVerified&&Array.isArray(vp?.sourceFacts)?vp.sourceFacts.length:0,suggestionCount:visualVerified&&Array.isArray(vp?.suggestions)?vp.suggestions.length:0},limitations:'真实引文仅说明来源匹配；sourceFacts声明不证明事实语义正确或全文资产穷尽。'}};
 })]))};
}
export function extractionReviewLabel(asset){
 const review=definition(asset).extractionReview;
 const pending=['pending','pending_confirmation'].includes(asset?.status)&&!asset?.resolvedAssetId;
 return pending&&review?.requiresHumanReview?'提取结果待人工核对':'';
}
export function prepareCandidates(candidates,units=[],knownAssets=[]){
 return candidates.map(c=>{
  const d={...(c.details||{})};let name=clean(d.identityName)||clean(c.name);
  const matches=knownAssets.filter(a=>a.category===c.category&&[a.name,a.title,definition(a).identityName,...(definition(a).aliases||[])].filter(Boolean).some(n=>identityKey(n)===identityKey(name)));
  const names=[...new Set(matches.map(a=>definition(a).identityName||a.name||a.title))];if(names.length===1)name=names[0];
  const variantName=clean(d.variantName);
  const chapter=units.find(u=>u.id===c.unitId);
  const originalName=clean(c.name);
  return {...c,name,details:{...d,name,identityName:name,aliases:[...new Set([...(Array.isArray(d.aliases)?d.aliases:[]),...(originalName!==name?[originalName]:[])])],entityType:d.entityType||(c.category==='character'?'character':c.category),variantName,extractionIdentityKey:identityKey(name),extractionVariantKey:variantName?identityKey(variantName):'default',extractionChapterTitle:chapter?.title||'',extractionTaskId:d.extractionSourceTaskId||d.verification?.taskId||''}};
 });
}
function definition(a){
 if(a?.details)return a.details;
 if(a?.detailsJson){try{return JSON.parse(a.detailsJson);}catch{}}
 return a?.character?.definition||a?.definition||a?.primaryVersion?.definition||{};
}
export function provenanceOf(a){return definition(a).extractionProvenance||a?.extractionProvenance;}
export function sourcesOf(a,units=[]){
 const p=provenanceOf(a);if(p?.sources?.length)return [...p.sources].sort((a,b)=>(a.chapterNumber||0)-(b.chapterNumber||0));
 const u=units.find(u=>u.id===a?.unitId);
 return u?[{unitId:u.id,chapterNumber:units.indexOf(u)+1,chapterTitle:u.title,legacy:true}]:[];
}
export function sourceLabel(a,units=[]){
 const sources=sourcesOf(a,units);if(!sources.length)return '来源章节待核实';
 return sources.map(s=>`第${s.chapterNumber||'?'}章${s.chapterTitle&&s.chapterTitle!==String(s.chapterNumber)?`「${s.chapterTitle}」`:''}`).join('、')+'提取';
}
export function provenancePanel(a,units,runtime){
 const p=provenanceOf(a);const sources=sourcesOf(a,units),reviewLabel=extractionReviewLabel(a),review=definition(a).extractionReview;if(!sources.length&&!p&&!reviewLabel)return null;
 const variants=p?.variants||[];const entityType=definition(a).entityType;
 return runtime.jsxs('details',{className:'mt-2 rounded border border-border/60 bg-background/40 p-2 text-xs',children:[
  runtime.jsx('summary',{className:'cursor-pointer text-foreground/65',children:`${entityType==='creature'?'生物 · ':''}${sourceLabel(a,units)}${variants.length>1?` · ${variants.length}个造型/状态`:''}`}),
  ...variants.map(v=>runtime.jsxs('div',{className:'mt-2 border-t border-border/40 pt-2',children:[runtime.jsx('strong',{children:v.name||'基础造型/状态'}),runtime.jsx('div',{className:'mt-1 text-foreground/55',children:(v.sources||[]).map(s=>`第${s.chapterNumber||'?'}章${s.chapterTitle&&s.chapterTitle!==String(s.chapterNumber)?`「${s.chapterTitle}」`:''}提取`).join('、')}),runtime.jsx('p',{className:'mt-1 whitespace-pre-wrap text-foreground/65',children:String(v.details?.clothing||v.details?.appearance||v.details?.description||'')})]},v.key)),
  reviewLabel?runtime.jsxs('div',{className:'mt-2 border-t border-border/40 pt-2',children:[runtime.jsx('strong',{children:reviewLabel}),runtime.jsx('p',{children:review.reason}),runtime.jsx('p',{children:`核对范围：${review.checkedScopes?.join('、')||'尚无可核对范围'}；${review.limitations}`}),...(review.sourceQuotes||[]).map((q,i)=>runtime.jsx('blockquote',{children:`原文引用：${q.quote}`},i)),runtime.jsx('p',{children:`视觉声明：${review.visualProvenance?.status==='provenance-declared'?`原文事实声明${review.visualProvenance.sourceFactCount}条、视觉建议${review.visualProvenance.suggestionCount}条`:'未提供经校验的事实/建议分区'}；仍需人工核对。`})]}):null
 ]});
}
export async function identityCatalog(projectId){
 const {w:init,_:detail}=await import('./projects-DAnF4Ptj.js');init();
 const p=await detail(projectId);
 const rows=[...(p.assetCandidates||[]).map(c=>({name:c.name,category:c.category,...definition(c)})),...(p.assets||[]).map(a=>({name:a.title,category:a.category,...definition(a)}))];
 const seen=new Set();return rows.filter(a=>{const key=a.category+':'+identityKey(a.identityName||a.name);if(seen.has(key))return false;seen.add(key);return true;}).map(a=>({name:a.identityName||a.name,aliases:a.aliases||[],entityType:a.entityType,variants:a.extractionProvenance?.variants?.map(v=>v.name)||[]}));
}
export async function enrichAssetProvenance(projectId,assets){
 if(!assets.length)return assets;
 const index=new Map();let page=1;
 for(;;){
  const response=await fetch(`/api/projects/${encodeURIComponent(projectId)}/asset-candidates?status=confirmed&page=${page}&pageSize=100`,{credentials:'same-origin'});
  const envelope=await response.json();if(!response.ok||envelope.code!==0)throw Error('读取资产章节来源失败');
  const data=envelope.data,rows=data.candidates||[];
  for(const row of rows)if(row.resolvedAssetId&&provenanceOf(row))index.set(row.resolvedAssetId,provenanceOf(row));
  if(rows.length<100||page*100>=data.total)break;page++;
 }
 return assets.map(a=>index.has(a.id)?{...a,extractionProvenance:index.get(a.id)}:a);
}

export function normalizeIdentityFields(data){
 return {...data,...Object.fromEntries([['characters','character'],['scenes','environment'],['props','prop']].map(([key,type])=>[key,data[key].map(a=>({...a,identityName:a.identityName?.trim()||a.name,entityType:a.entityType||type,variantName:typeof a.variantName==='string'?a.variantName:''}))]))};
}
