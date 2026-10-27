const norm=s=>String(s||'').toLowerCase().replace(/[\s·•・《》〈〉「」『』【】\[\]（）()、，,:：。;；\-—_]/g,'');
import {completePrompt,mainPrompt} from './storyboard-detail-contract.js';
export {DEFAULT_STORYBOARD_RULES as PRESENTATION_RULES} from './storyboard-template-standard.js';
function aliasesFor(asset){
 let definition=asset.character?.definition||asset.definition||{};
 if(typeof definition==='string'){try{definition=JSON.parse(definition)}catch{definition={}}}
 const title=asset.title||'';const aliases=[title,title.replace(/(?:群体|群像)$/,''),...(Array.isArray(definition.aliases)?definition.aliases:[]),title.replace('旁听席','旁听')];
 if(asset.category==='environment'&&/[·]/.test(title)&&/全景|远眺/.test(title.split('·').at(-1)))aliases.push(title.split('·')[0]);
 if(asset.category==='environment'&&title.includes('街头'))aliases.push(title.split('·')[0]+'街头');
 if(asset.category==='prop'&&title.includes('旗帜'))aliases.push(title.replace(/旗帜$/,''));
 if(asset.category==='environment'&&title.includes('省公署'))aliases.push('省公署');
 if(asset.category==='character'&&/学生代表|学生群/.test(title))aliases.push('学生人潮','列队学生','激昂学生','数名学生','学生队伍','数千学生','数千名学生','学生人潮矩阵','青年学生');
 if(asset.category==='character'&&title.includes('欢迎'))aliases.push('欢迎的学生','欢迎的群众','热烈欢迎');
 if(asset.category==='prop'&&title.includes('旗帜'))aliases.push('标语旗帜');
 if(asset.category==='prop'&&title.includes('步枪'))aliases.push('步枪');
 if(asset.category==='prop'&&title.includes('刺刀'))aliases.push('刺刀');
 return [...new Set(aliases.filter(s=>typeof s==='string'&&s.trim()))];
}
function names(asset){return [...new Set(aliasesFor(asset).map(norm))].filter(s=>s.length>=2);}
function nonVisualMention(text,start,end){
 const before=text.slice(Math.max(0,start-24),start),after=text.slice(end,end+24);
 return /^(?:在本镜|在画面中|在镜头中)?(?:不|未|没有|不会|不得|禁止|不要|无需|无须)(?:再|实际|在本镜|在画面中|在镜头中|直接|真正)?(?:出场|出现|入镜|可见|露面)/.test(after)
  || /^(?:仅|只|只是)(?:在)?(?:被)?(?:提及|提到|回忆|说起)/.test(after)
  || /^(?:不|未)在(?:本镜|画面|镜头)中?(?:出现|出场|入镜|露面)/.test(after)
  || /(?:不出现|未出现|没有|不含|不包括|排除|禁止出现|不要出现|不得出现|无需出现|无须出现|仅提及|只提及|提到|提及|回忆中的|画外音来自|画外声音来自)$/.test(before);
}
export function analyzeBindings(shot,revision,assets){
 const prompt=revision.videoPrompt||'';
 // Do not attach people merely named by narration, voice instructions or inherited states.
 let visual=mainPrompt(prompt).replace(/【(?:角色固定音色锁|上段继承状态锁|BGM[^】]*|声音[^】]*|音效[^】]*|画面约束[^】]*|负面[^】]*|素材引用待核对)】[^【]*/g,'').replace(/(?:旁白|对白|OS|OV|台词|画外音|画外声音)[：:][^\n]*/g,'');
 visual=visual.replace(/^(?:台词及固定音色[^\n]*|声效与跨段[^\n]*)$/gm,'').replace(/(?:无绑定则写|无绑定则|未绑定真实素材ID|无绑定|不虚构ID)[^\n]*/g,'');
 const segments=[shot.description,revision.plotDescription,revision.action,visual].filter(Boolean).join('\n').split(/[\n，,。；;！？!?]/).map(norm).filter(Boolean);
 const matches=[];
 const usable=assets.filter(a=>['character','environment','prop'].includes(a.category)&&(a.primaryVersionId||a.pending));
 for(let segment=0;segment<segments.length;segment++)for(const asset of usable)for(const name of names(asset)){
   const text=segments[segment];let start=text.indexOf(name);
   while(start>=0){if(!nonVisualMention(text,start,start+name.length))matches.push({asset,name,segment,start,end:start+name.length});start=text.indexOf(name,start+name.length)}
 }
 // Prefer the specific document/location over an overlapping shorter generic name.
 matches.sort((a,b)=>b.name.length-a.name.length);
 const accepted=[];
 for(const match of matches){if(!accepted.some(m=>m.segment===match.segment&&m.asset.category===match.asset.category&&match.start>=m.start&&match.end<=m.end&&m.name.length>match.name.length))accepted.push(match);}
 const issues=[],resolved=[];
 const groups=new Map();for(const match of accepted){const key=[match.segment,match.start,match.end,match.asset.category].join(':');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(match);}
 for(const group of groups.values()){
  const exact=group.filter(m=>norm(m.asset.title)===m.name),candidates=exact.length?exact:group;
  const distinct=[...new Map(candidates.map(m=>[m.asset.id,m.asset])).values()];
  if(distinct.length===1)resolved.push(distinct[0]);
  else issues.push({kind:'ambiguous-alias',name:group[0].name,candidates:distinct.map(a=>({id:a.id,title:a.title,unitId:a.unitId}))});
 }
 return {assets:[...new Map(resolved.map(a=>[a.id,a])).values()],issues:[...new Map(issues.map(i=>[i.name+':'+i.candidates.map(c=>c.id).sort().join(','),i])).values()]};
}
export function inferBindings(shot,revision,assets){return analyzeBindings(shot,revision,assets).assets;}
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function removeManagedIntroduction(text,known){
 const lines=text.split('\n');
 const tokens=a=>[...new Set([mentionToken(a),a.title,'@'+a.title,`@[asset:${a.id}]`])];
 const declarations=known.flatMap(a=>tokens(a).flatMap(token=>[a.title,'@'+a.title].flatMap(title=>['','，待确认素材'].flatMap(suffix=>[`(${token} 是${title}${suffix})`,`（${token} 是${title}${suffix}）`,...title.startsWith('@')?[`(${token} 是${title}${suffix}`,`（${token} 是${title}${suffix}`]:[]])))).sort((a,b)=>b.length-a.length);
 const scenes=known.filter(a=>a.category==='environment').flatMap(a=>tokens(a).filter(token=>token.startsWith('@')).map(token=>'本Seq场景为'+token)).sort((a,b)=>b.length-a.length);
 // Only consume complete, recognisable host declarations at the very start.
 // Never delete an ordinary scene sentence or a line with additional prose.
 while(lines.length){
  const line=lines[0].trim();if(!line){lines.shift();continue;}
  let remainder=line,count=0;
  for(const declaration of declarations)if(remainder.includes(declaration)){count++;remainder=remainder.split(declaration).join('');}
  for(const scene of scenes)if(remainder.includes(scene)){count++;remainder=remainder.split(scene).join('');}
  remainder=remainder.replace(/本Seq场景为/g,'').replace(/[；;、。\s]/g,'');
  if(!count||remainder)break;
  lines.shift();
 }
 return lines.join('\n').trim();
}
export function bindPrompt(prompt,assets,{issues=[]}={}){
 const known=[...new Map(assets.map(a=>[a.id||a.assetId,{...a,id:a.id||a.assetId,title:a.title||a.label}])).values()].filter(a=>a.id&&a.title);
 if(!known.length&&!issues.length)return String(prompt||'').includes('角色固定音色锁')?completePrompt(prompt):String(prompt||'');
 const byId=new Map(known.map(a=>[a.id,a]));
 const hints=new Map([...String(prompt||'').matchAll(/@\[asset:([^\]]+)\]\s*是([^；;()（）\n]+)/g)].map(m=>[m[1],m[2].trim()]));
 const warnings=issues.length?'【素材引用待核对】'+issues.map(i=>`“${i.name}”对应多个素材（${i.candidates.map(c=>'@'+c.title).join('、')}），尚未自动绑定，请明确实际身份。`).join(''):'';
 let body=removeManagedIntroduction(mainPrompt(prompt),known).split('\n').filter(line=>!warnings||line!==warnings).join('\n').replace(/@\[asset:([^\]]+)\]/g,(token,id)=>byId.has(id)?mentionToken(byId.get(id)):hints.get(id)||'未绑定素材');
 const candidates=[];
 for(const asset of known.filter(a=>a.mentionable!==false||a.pending)){
  const aliases=aliasesFor(asset);
  if(asset.category==='character'&&/学生代表|学生群/.test(asset.title))aliases.push('数千学生人潮矩阵','数千名学生人潮','数千学生人潮','学生人潮','学生代表','列队学生');
  if(asset.category==='character'&&asset.title.includes('旁听席'))aliases.push('旁听群众','旁听席群众');
  if(asset.category==='prop'&&asset.title.includes('旗帜'))aliases.push('标语旗帜',asset.title.replace(/旗帜$/,''));
  if(asset.category==='environment'&&asset.title.includes('街头'))aliases.push(asset.title.split('·')[0]+'街头');
  for(const alias of aliases)if(alias)candidates.push({alias,asset});
 }
 candidates.sort((a,b)=>b.alias.length-a.alias.length);
 const aliases=[...new Set(candidates.map(x=>x.alias))];
 const pattern=aliases.length?new RegExp('(?:@)?(?:'+aliases.map(escape).join('|')+')','g'):null;
 if(pattern)body=body.split('\n').map(line=>{
  if(/^(?:台词及固定音色|(?:💬\s*)?(?:台词|旁白|对白|OS|OV)[：:（(]|声效与跨段)/.test(line.trim()))return line;
  return line.split(/(@\[asset:[^\]]+\])/g).map(part=>part.startsWith('@[asset:')?part:part.replace(pattern,(word,offset)=>{const alias=word.replace(/^@/,'');const matches=candidates.filter(c=>c.alias===alias),exact=matches.filter(c=>c.asset.title===alias),distinct=[...new Map((exact.length?exact:matches).map(c=>[c.asset.id,c.asset])).values()];const start=norm(part.slice(0,offset)).length;if(distinct.length!==1||nonVisualMention(norm(part),start,start+norm(word).length))return word;return mentionToken(distinct[0]);})).join('');
 }).join('\n');
 let index=0;
 body=body.replace(/[【\[]\s*(\d+(?:\.\d+)?)\s*[-—~至]\s*(\d+(?:\.\d+)?)\s*秒([^】\]]*)[】\]]\s*[：:]?/g,(whole,start,end,note)=>{const a=Number(start),b=Number(end);if(b<=a)return whole;if(a===0)index=0;index++;return `镜头${index}（预估本镜：${(b-a).toFixed(1)}秒 ｜ 本Seq累加: 约${b.toFixed(1)}秒）：${note.trim()?`（${note.trim()}）`:''}`;});
 body=body.replace(/(?:\*\*)?(?:机位与运镜\/轴线\/构图|机位与构图)(?:\*\*)?[：:]/g,'🎥 机位与构图：').replace(/光影投影与环境联动[：:]/g,'💡 光影与环境：').replace(/表演与体态\/持物手\/防穿帮[：:]/g,'🎭 表演与防穿帮：').replace(/^声效与跨段同步[：:]/gm,'🔊 声效：');
 body=body.replace(/(?:🎥\s*){2,}/g,'🎥 ');
 const people=known.filter(a=>a.category!=='environment').map(a=>`(${mentionToken(a)} 是${a.title}${a.pending?'，待确认素材':''})`).join('；');
 const scenes=known.filter(a=>a.category==='environment').map(a=>`(${mentionToken(a)} 是${a.title}${a.pending?'，待确认素材':''})`).join('、');
 const output=[people+(people?'；':'')+(scenes?`本Seq场景为${scenes}。`:''),body.trim(),warnings].filter(Boolean).join('\n\n').replace(/(@\[asset:[^\]]+\])(?=[^\s，。；：、;:,.!?！？()（）\[\]【】])/g,'$1 ');
 return output.includes('角色固定音色锁')&&output.includes('场景九宫格')?completePrompt(output):output;
}
export async function repairStoredProject(projectId){
 const [{_ :getProject},{a:client}]=await Promise.all([import('./projects-DAnF4Ptj.js'),import('./request-Dlp4yxtR.js')]);
 const detail=await getProject(projectId);
 const payload=await client.get(`/projects/${encodeURIComponent(projectId)}/assets`);
 const assets=referenceCatalog({...detail,assets:payload.assets||detail.assets||[]});
 for(const shot of detail.shots||[]){
  const revision=detail.shotRevisions.find(r=>r.id===shot.currentRevisionId);if(!revision)continue;
  const existing=(detail.shotReferences||[]).filter(r=>r.shotId===shot.id&&r.status==='linked');
  const scoped=assets.filter(a=>!a.pending||!a.unitId||a.unitId===shot.unitId);
  const analysis=analyzeBindings(shot,revision,scoped),inferred=analysis.assets;
  const linked=new Set(existing.map(r=>r.assetVersionId));
  for(const asset of inferred)if(asset.primaryVersionId&&!linked.has(asset.primaryVersionId)){await client.post(`/projects/${projectId}/shots/${shot.id}/assets`,{assetVersionId:asset.primaryVersionId,role:'reference'});linked.add(asset.primaryVersionId);}
  const bound=scoped.filter(a=>a.primaryVersionId&&linked.has(a.primaryVersionId)||a.pending&&inferred.some(i=>i.id===a.id));
  const videoPrompt=bindPrompt(revision.videoPrompt,bound,{issues:analysis.issues});
  if(videoPrompt!==revision.videoPrompt)await client.post(`/projects/${projectId}/shots`,{id:shot.id,unitId:shot.unitId,title:shot.title,description:shot.description,position:shot.position,durationMs:shot.durationMs,status:shot.status,revision:{...revision,videoPrompt}});
 }
}
export function augmentReferences(result,detail,shotId){
 const seen=new Set(result.mentionReferences.map(r=>r.assetId));
 const byVersion=new Map(detail.assets.filter(a=>a.primaryVersionId).map(a=>[a.primaryVersionId,a]));
 for(const reference of detail.shotReferences||[]){
  if(reference.shotId!==shotId||reference.status!=='linked')continue;
  const asset=byVersion.get(reference.assetVersionId)||reference.asset;
  if(!asset||seen.has(asset.id))continue;seen.add(asset.id);
  result.mentionReferences.push({id:`project-asset:${asset.id}`,nodeId:'',assetId:asset.id,kind:asset.category==='character'?'character':'image',label:asset.title,title:asset.title,active:true,category:asset.category,mentionable:true});
  result.assetReferences.push({assetId:asset.id,title:asset.title,category:asset.category});
 }
 return result;
}

function mentionToken(asset){return asset.pending?`@${asset.title}`:asset.mentionable===false?asset.title:`@[asset:${asset.id}]`;}
export function referenceCatalog(detail,unitId){
 const assets=(detail.assets||[]).filter(a=>['character','environment','prop'].includes(a.category)&&a.primaryVersionId);
 const seen=new Set();
 const pending=[];
 for(const c of detail.assetCandidates||[]){
  if(!['character','environment','prop'].includes(c.category)||['rejected','ignored','confirmed'].includes(c.status)||unitId&&c.unitId&&c.unitId!==unitId||seen.has(c.id))continue;
  // Only an explicit resolution proves a pending record is the same identity.
  // A matching display name alone must not hide another chapter/character.
  if(c.resolvedAssetId&&assets.some(a=>a.id===c.resolvedAssetId&&a.category===c.category))continue;
  let definition=c.details||c.detailsJson||{};if(typeof definition==='string'){try{definition=JSON.parse(definition)}catch{definition={}}}
  seen.add(c.id);pending.push({id:`candidate:${c.id}`,title:c.name,category:c.category,pending:true,unitId:c.unitId,definition,character:c.category==='character'?{definition}:undefined});
 }
 return [...assets,...pending];
}
export function prepareShotRows(rows,detail,unitId){
 const catalog=referenceCatalog(detail,unitId);
 return rows.map(input=>{
  const {referenceHints=[],...row}=input;
  const revision=row.revision||{};
  const hints=[...referenceHints,...[...(revision.videoPrompt||'').matchAll(/@([^\s，。；：、;:,.!?！？()（）\[\]【】]+)/g)].map(m=>m[1])];
  const local=[...catalog];
  for(const hint of hints){const title=String(hint||'').trim();if(!title||local.some(a=>names(a).includes(norm(title))))continue;local.push({id:`unresolved:${title}`,title,category:'character',pending:true});}
  const analysis=analyzeBindings(row,revision,local),inferred=analysis.assets;
  const existing=new Set(row.assetVersionIds||[]);
  for(const asset of inferred)if(asset.primaryVersionId)existing.add(asset.primaryVersionId);
  const ambiguousIds=new Set(analysis.issues.flatMap(i=>i.candidates.map(c=>c.id)));
  const bound=local.filter(a=>a.primaryVersionId&&existing.has(a.primaryVersionId)||a.pending&&(inferred.some(i=>i.id===a.id)||referenceHints.includes(a.title)&&!ambiguousIds.has(a.id)));
  return {...row,assetVersionIds:[...existing],revision:{...revision,videoPrompt:bindPrompt(revision.videoPrompt,bound,{issues:analysis.issues})}};
 });
}
