// v6 opt-in validation. Model self-inventory is auditable, never an exhaustive-source proof.
export const SOURCE_INVENTORY_RULES=`
【来源清单合同 v6】顶层characters、scenes、props数组保持原样，另加sourceInventory数组。非空正文至少列一项。每项只包含kind（character/environment/prop/other）、name（原文主体名）、quote（正文中连续逐字原句片段）、occurrence（该quote从正文开头计数第几次，正整数）、assetName（对应输出资产name；kind=other时为空）、disposition（asset或non_asset）、reason（分类/非资产原因）。kind为character/environment/prop时disposition必须为asset，且assetName必须映射到对应数组的真实name。正文有独立可制作物件时不能仅把它写进场景陈设而漏props。对没有可制作资产的正文，可用kind=other、disposition=non_asset逐字引用并说明原因；这只作为待人工核对说明，不能伪造资产。quote必须来自本次正文，不引用模板或自行改写。不输出字符下标，避免编码计数误差；宿主按quote与occurrence计算真实跨度。清单是逐句自查，不得宣称它独立证明全文穷尽。
【事实与视觉补全】每个资产增加visualProvenance对象：sourceFacts为字符串数组，仅列正文直接支持的事实；suggestions为字符串数组，列所有为绘图补充但正文未明确的年龄细化、五官、发型、材质、服装结构、环境结构等。未知可写“正文未明确”。绘图提示词可采用建议，但必须有明确“造型建议”或“视觉补全建议”标签，不能与sourceFacts混写。不要把建议反写为身份、关系、剧情或原文发生的事实。
`;

const categoryArrays={character:'characters',environment:'scenes',prop:'props'};
const nameKey=value=>String(value??'').normalize('NFKC').trim();

export function locateSourceQuote(source,quote,occurrence){
 if(typeof quote!=='string'||!quote.trim())throw Error('sourceInventory.quote必须是非空正文原文片段');
 if(!Number.isSafeInteger(occurrence)||occurrence<1)throw Error('sourceInventory.occurrence必须为从1开始的正整数');
 let start=-1;
 for(let i=0;i<occurrence;i++){start=source.indexOf(quote,start+1);if(start<0)throw Error('sourceInventory引用片段或出现次数不属于本次正文');}
 return {start,end:start+quote.length,unit:'utf16-code-unit'};
}

export function validateSourceInventory(data,variables,{contractVersion=6}={}){
 if(contractVersion<6)return {status:'legacy-unchecked',requiresHumanReview:true,reason:'旧任务未声明来源清单合同，保持恢复兼容；未证明完整。'};
 const source=String(variables?.['章节正文']||'');
 if(!Array.isArray(data?.sourceInventory))throw Error('来源清单合同v6要求顶层sourceInventory数组');
 if(source.trim()&&!data.sourceInventory.length)throw Error('非空正文必须提供至少一条可审查sourceInventory来源清单');
 const spans=[],mapped=new Set();
 for(const [index,item]of data.sourceInventory.entries()){
  if(!item||typeof item!=='object'||Array.isArray(item))throw Error(`来源清单第${index+1}项必须为对象`);
  const {kind,name,quote,occurrence,assetName,disposition,reason}=item;
  if(!['character','environment','prop','other'].includes(kind))throw Error(`来源清单第${index+1}项kind无效`);
  if(typeof name!=='string'||!name.trim()||typeof reason!=='string'||!reason.trim())throw Error(`来源清单第${index+1}项缺少名称或分类说明`);
  const span=locateSourceQuote(source,quote,occurrence);
  if(kind==='other'){
   if(disposition!=='non_asset'||assetName!=='')throw Error('非资产来源项必须标记non_asset且assetName为空');
  }else{
   if(disposition!=='asset'||typeof assetName!=='string'||!assetName.trim())throw Error(`来源${name}必须映射实际资产，不能用非资产理由绕过`);
   const key=categoryArrays[kind],candidates=(data[key]||[]).filter(a=>[a.name,a.identityName].some(n=>nameKey(n)&&nameKey(n)===nameKey(assetName)));
   if(candidates.length>1)throw Error(`来源清单中的${name}映射存在同名身份歧义：${assetName}`);
   const asset=candidates[0];
   if(!asset)throw Error(`来源清单中的${name}未映射至${key}实际资产：${assetName}`);
   mapped.add(`${kind}:${nameKey(asset.name)}`);
  }
  spans.push({index,kind,name,assetName,quote,occurrence,...span});
 }
 // Every generated asset must expose at least one real source; this also rejects extra invented entities.
 for(const[kind,key]of Object.entries(categoryArrays))for(const asset of data[key]||[])if(!mapped.has(`${kind}:${nameKey(asset.name)}`))throw Error(`生成资产${asset.name}缺少对应sourceInventory原文来源`);
 return {status:'self-inventory-linked',contractVersion:6,verifiedQuoteCount:spans.length,mappedAssetCount:mapped.size,spans,requiresHumanReview:true,reason:'仅确认模型自查清单引用真实且已映射资产；清单本身仍可能漏项或误分类，不证明全文穷尽。'};
}

export function validateVisualProvenance(data,{contractVersion=6}={}){
 if(contractVersion<6)return {status:'legacy-unchecked',requiresHumanReview:true};
 let assets=0,suggestions=0;
 for(const key of ['characters','scenes','props'])for(const asset of data[key]||[]){
  const provenance=asset.visualProvenance;
  if(!provenance||typeof provenance!=='object'||Array.isArray(provenance))throw Error(`资产${asset.name}缺少visualProvenance事实/视觉建议分区`);
  for(const field of ['sourceFacts','suggestions'])if(!Array.isArray(provenance[field])||!provenance[field].every(s=>typeof s==='string'&&s.trim()))throw Error(`资产${asset.name}.visualProvenance.${field}必须为非空字符串条目的数组`);
  const facts=new Set(provenance.sourceFacts.map(nameKey));
  if(provenance.suggestions.some(s=>facts.has(nameKey(s))))throw Error(`资产${asset.name}将同一内容同时列为原文事实与视觉建议`);
  // 22–24 or managed fixed layout is host-appended; a marker there cannot
  // retroactively label unmarked visual additions in the character-specific body.
  const prompt=key==='characters'?String(asset.multiViewPrompt||'').split(/\[22[.．]摄影排版指令\]|【人物排版】/)[0]:String(asset.prompt||'');
  if(provenance.suggestions.length&&!/造型建议|视觉补全建议/.test(prompt))throw Error(`资产${asset.name}有视觉补全但绘图提示词未标建议`);
  assets++;suggestions+=provenance.suggestions.length;
 }
 return {status:'provenance-declared',assetCount:assets,suggestionCount:suggestions,requiresHumanReview:true,reason:'仅验证事实/建议声明结构和显式标签；是否完全标出所有补充、sourceFacts是否真实仍需人工复核。'};
}

export function validateScenePromptSections(data,{contractVersion=6}={}){
 if(contractVersion<6)return {status:'legacy-unchecked',requiresHumanReview:true};
 const required=['0','1','2','3','3.5','4','5','6','7','8','9','10'];
 for(const scene of data.scenes||[]){
  const prompt=String(scene.prompt||'');
  const matches=[...prompt.matchAll(/\[((?:3[.．]5)|\d+)[.．]?([^\]\n]+)\]\s*[：:]?/g)];
  for(const number of required){
   const found=matches.filter(m=>m[1].replace('．','.')===number);
   if(found.length!==1)throw Error(`场景${scene.name}的prompt第${number}节缺失或重复，必须按管理员模板填写完整12节`);
   const match=found[0],next=matches.find(m=>m.index>match.index),body=prompt.slice(match.index+match[0].length,next?.index??prompt.length).trim();
   if(!/[\p{L}\p{N}]/u.test(body)||/^(?:同上|略|待补充|TODO|TBD|…|\.\.\.)[。.!！\s]*$/i.test(body))throw Error(`场景${scene.name}的prompt第${number}节内容为空或占位`);
  }
 }
 return {status:'scene-sections-present',sceneCount:data.scenes?.length||0,requiredSections:required,requiresHumanReview:true,reason:'仅核对12节结构和非空内容；事实、布局、动态隔离和视觉效果仍需人工审查。'};
}
