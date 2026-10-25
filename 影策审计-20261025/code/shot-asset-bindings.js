const norm=s=>String(s||'').toLowerCase().replace(/[\s·•・《》〈〉「」『』【】\[\]（）()、，,:：。;
；\-—_]/g,'');

import {completePrompt} from './storyboard-detail-contract.js';

export {DEFAULT_STORYBOARD_RULES as PRESENTATION_RULES} from './storyboard-template-standard.js';

function names(asset){
 let definition=asset.character?.definition||asset.definition||{};

 if(typeof definition==='string'){try{definition=JSON.parse(definition)}catch{definition={}}}
 const title=asset.title||'';
const aliases=[title,title.replace(/(?:群体|群像)$/,''),...(Array.isArray(definition.aliases)?definition.aliases:[]),title.replace('旁听席','旁听')];

 if(asset.category==='environment'&&/[·]/.test(title)&&/全景|远眺/.test(title.split('·').at(-1)))aliases.push(title.split('·')[0]);

 if(asset.category==='environment'&&title.includes('街头'))aliases.push(title.split('·')[0]+'街头');

 if(asset.category==='prop'&&title.includes('旗帜'))aliases.push(title.replace(/旗帜$/,''));

 if(asset.category==='environment'&&title.includes('省公署'))aliases.push('省公署');

 if(asset.category==='character'&&/学生代表|学生群/.test(title))aliases.push('学生人潮','列队学生','激昂学生','数名学生','学生队伍','数千学生','数千名学生','学生人潮矩阵','青年学生');

 if(asset.category==='character'&&title.includes('欢迎'))aliases.push('欢迎的学生','欢迎的群众','热烈欢迎');

 if(asset.category==='prop'&&title.includes('旗帜'))aliases.push('标语旗帜');

 if(asset.category==='prop'&&title.includes('步枪'))aliases.push('步枪');

 if(asset.category==='prop'&&title.includes('刺刀'))aliases.push('刺刀');

 return [...new Set(aliases.filter(Boolean).map(norm))].filter(s=>s.length>=2);

}
export function inferBindings(shot,revision,assets){
 const prompt=revision.videoPrompt||'';

 // Do not attach people merely named by narration, voice instructions or inherited states.
 let visual=prompt.replace(/【(?:角色固定音色锁|上段继承状态锁|BGM[^】]*|声音[^】]*|音效[^】]*|画面约束[^】]*|负面[^】]*)】[^【]*/g,'').replace(/(?:旁白|对白|OS|OV|台词)[：:][^\n]*/g,'');

 visual=visual.replace(/^(?:台词及固定音色[^\n]*|声效与跨段[^\n]*)$/gm,'').replace(/(?:无绑定则写|无绑定则|未绑定真实素材ID|无绑定|不虚构ID)[^\n]*/g,'');

 let text=norm([shot.description,revision.plotDescription,revision.action,visual].filter(Boolean).join('\n'));

 const matches=[];

 const usable=assets.filter(a=>['character','environment','prop'].includes(a.category)&&(a.primaryVersionId||a.pending));

 for(const asset of usable)for(const name of names(asset)){
   let start=text.indexOf(name);

   while(start>=0){matches.push({asset,name,start,end:start+name.length});
start=text.indexOf(name,start+name.length)}
 }
 // Prefer the specific document/location over an overlapping shorter generic name.
 matches.sort((a,b)=>b.name.length-a.name.length);

 const accepted=[];

 for(const match of matches){if(!accepted.some(m=>m.asset.category===match.asset.category&&match.start>=m.start&&match.end<=m.end&&m.asset.id!==match.asset.id))accepted.push(match);
}
 const unique=[...new Map(accepted.map(m=>[m.asset.id,m.asset])).values()];

 return unique.filter(a=>!unique.some(b=>a!==b&&a.category===b.category&&norm(b.title).includes(norm(a.title))&&norm(b.title).length>norm(a.title).length));

}
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

export function bindPrompt(prompt,assets){
 const known=[...new Map(assets.map(a=>[a.id||a.assetId,{...a,id:a.id||a.assetId,title:a.title||a.label}])).values()].filter(a=>a.id&&a.title);

 const byId=new Map(known.map(a=>[a.id,a]));

 const hints=new Map([...String(prompt||'').matchAll(/@\[asset:([^\]]+)\]\s*是([^；;
()（）\n]+)/g)].map(m=>[m[1],m[2].trim()]));

 let body=String(prompt||'').replace(/@\[asset:([^\]]+)\]/g,(token,id)=>byId.get(id)?.title||hints.get(id)||'未绑定素材').trim();

 if(/^[（(].*?\s是/.test(body.split('\n')[0]))body=body.split('\n').slice(1).join('\n').trim();

 body=body.replace(/^.*本Seq场景为[^\n]*\n?/gm,'');

 body=body.replace(/[（(]\s*@?[^\n;
；)）]+?\s+是(?:人物|角色|群体|道具|场景)?(?:名称|名)?\s*[)）]?[;
；]?/g,'').replace(/本Seq全程发生于[^\n]*/g,'').replace(/场景是@?[^\n]*/g,'').replace(/无绑定则写真实名称及未绑定，不虚构ID。|未绑定真实素材ID。|未绑定。/g,'').trim();

 // Remove the previous bare asset-name list, retaining all actual scene prose.
 let lines=body.split('\n');
while(lines.length&&(!lines[0].trim()||known.every(a=>lines[0].includes(a.title))&&lines[0].length<=known.reduce((n,a)=>n+a.title.length,0)+known.length*2))lines.shift();
body=lines.join('\n');

 const candidates=[];

 for(const asset of known.filter(a=>a.mentionable!==false||a.pending)){
  const aliases=[asset.title,asset.title.replace(/(?:群体|群像)$/, ''),...(asset.character?.definition?.aliases||[]),...(asset.definition?.aliases||[])];

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

  return line.split(/(@\[asset:[^\]]+\])/g).map(part=>part.startsWith('@[asset:')?part:part.replace(pattern,word=>{const match=candidates.find(c=>c.alias===word.replace(/^@/,''));
return match?mentionToken(match.asset):word;
})).join('');

 }).join('\n');

 let index=0;

 body=body.replace(/[【\[]\s*(\d+(?:\.\d+)?)\s*[-—~至]\s*(\d+(?:\.\d+)?)\s*秒([^】\]]*)[】\]]\s*[：:]?/g,(whole,start,end,note)=>{const a=Number(start),b=Number(end);
if(b<=a)return whole;
if(a===0)index=0;
index++;
return `镜头${index}（预估本镜：${(b-a).toFixed(1)}秒 ｜ 本Seq累加: 约${b.toFixed(1)}秒）：${note.trim()?`（${note.trim()}）`:''}`;
});

 body=body.replace(/(?:\*\*)?(?:机位与运镜\/轴线\/构图|机位与构图)(?:\*\*)?[：:]/g,'🎥 机位与构图：').replace(/光影投影与环境联动[：:]/g,'💡 光影与环境：').replace(/表演与体态\/持物手\/防穿帮[：:]/g,'🎭 表演与防穿帮：').replace(/^声效与跨段同步[：:]/gm,'🔊 声效：');

 body=body.replace(/(?:🎥\s*){2,}/g,'🎥 ');

 const people=known.filter(a=>a.category!=='environment').map(a=>`(${mentionToken(a)} 是${a.title}${a.pending?'，待确认素材':''})`).join('；');

 const scenes=known.filter(a=>a.category==='environment').map(a=>`(${mentionToken(a)} 是${a.title}${a.pending?'，待确认素材':''})`).join('、');

 const output=[people+(people?'；':'')+(scenes?`本Seq场景为${scenes}。`:''),body.trim()].filter(Boolean).join('\n\n').replace(/(@\[asset:[^\]]+\])(?=[^\s，。；：、;
:,.!?！？()（）\[\]【】])/g,'$1 ');

 return output.includes('角色固定音色锁')&&output.includes('场景九宫格')?completePrompt(output):output;

}
export async function repairStoredProject(projectId){
 const [{_ :getProject},{a:client}]=await Promise.all([import('./projects-DAnF4Ptj.js'),import('./request-Dlp4yxtR.js')]);

 const detail=await getProject(projectId);

 const payload=await client.get(`/projects/${encodeURIComponent(projectId)}/assets`);

 const assets=referenceCatalog({...detail,assets:payload.assets||detail.assets||[]});

 for(const shot of detail.shots||[]){
  const revision=detail.shotRevisions.find(r=>r.id===shot.currentRevisionId);
if(!revision)continue;

  const existing=(detail.shotReferences||[]).filter(r=>r.shotId===shot.id&&r.status==='linked');

  const inferred=inferBindings(shot,revision,assets);

  const linked=new Set(existing.map(r=>r.assetVersionId));

  for(const asset of inferred)if(asset.primaryVersionId&&!linked.has(asset.primaryVersionId)){await client.post(`/projects/${projectId}/shots/${shot.id}/assets`,{assetVersionId:asset.primaryVersionId,role:'reference'});
linked.add(asset.primaryVersionId);
}
  const bound=assets.filter(a=>a.primaryVersionId&&linked.has(a.primaryVersionId)||a.pending&&inferred.some(i=>i.id===a.id));

  const videoPrompt=bindPrompt(revision.videoPrompt,bound);

  if(videoPrompt!==revision.videoPrompt)await client.post(`/projects/${projectId}/shots`,{id:shot.id,unitId:shot.unitId,title:shot.title,description:shot.description,position:shot.position,durationMs:shot.durationMs,status:shot.status,revision:{...revision,videoPrompt}});

 }
}
export function augmentReferences(result,detail,shotId){
 const seen=new Set(result.mentionReferences.map(r=>r.assetId));

 const byVersion=new Map(detail.assets.filter(a=>a.primaryVersionId).map(a=>[a.primaryVersionId,a]));

 for(const reference of detail.shotReferences||[]){
  if(reference.shotId!==shotId||reference.status!=='linked')continue;

  const asset=byVersion.get(reference.assetVersionId)||reference.asset;

  if(!asset||seen.has(asset.id))continue;
seen.add(asset.id);

  result.mentionReferences.push({id:`project-asset:${asset.id}`,nodeId:'',assetId:asset.id,kind:asset.category==='character'?'character':'image',label:asset.title,title:asset.title,active:true,category:asset.category,mentionable:true});

  result.assetReferences.push({assetId:asset.id,title:asset.title,category:asset.category});

 }
 return result;

}

function mentionToken(asset){return asset.pending?`@${asset.title}`:asset.mentionable===false?asset.title:`@[asset:${asset.id}]`;
}
export function referenceCatalog(detail){
 const assets=(detail.assets||[]).filter(a=>['character','environment','prop'].includes(a.category)&&a.primaryVersionId);

 const known=new Set(assets.map(a=>norm(a.title)));

 const pending=[];

 for(const c of detail.assetCandidates||[]){
  if(!['character','environment','prop'].includes(c.category)||['rejected','ignored','confirmed'].includes(c.status)||known.has(norm(c.name)))continue;

  let definition=c.details||c.detailsJson||{};
if(typeof definition==='string'){try{definition=JSON.parse(definition)}catch{definition={}}}
  known.add(norm(c.name));
pending.push({id:`candidate:${c.id}`,title:c.name,category:c.category,pending:true,unitId:c.unitId,definition,character:c.category==='character'?{definition}:undefined});

 }
 return [...assets,...pending];

}
export function prepareShotRows(rows,detail,unitId){
 const catalog=referenceCatalog(detail).filter(a=>!a.pending||!a.unitId||a.unitId===unitId);

 return rows.map(input=>{
  const {referenceHints=[],...row}=input;

  const revision=row.revision||{};

  const hints=[...referenceHints,...[...(revision.videoPrompt||'').matchAll(/@([^\s，。；：、;
:,.!?！？()（）\[\]【】]+)/g)].map(m=>m[1])];

  const local=[...catalog];

  for(const hint of hints){const title=String(hint||'').trim();
if(!title||local.some(a=>names(a).includes(norm(title))))continue;
local.push({id:`unresolved:${title}`,title,category:'character',pending:true});
}
  const inferred=inferBindings(row,revision,local);

  const existing=new Set(row.assetVersionIds||[]);

  for(const asset of inferred)if(asset.primaryVersionId)existing.add(asset.primaryVersionId);

  const bound=local.filter(a=>a.primaryVersionId&&existing.has(a.primaryVersionId)||a.pending&&(inferred.some(i=>i.id===a.id)||referenceHints.includes(a.title)));

  return {...row,assetVersionIds:[...existing],revision:{...revision,videoPrompt:bindPrompt(revision.videoPrompt,bound)}};

 });

}
