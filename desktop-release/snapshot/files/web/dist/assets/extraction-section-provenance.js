import {annotateResult,fixedLayoutSections} from './character-prompt-formats.js';
import {locateSourceQuote} from './extraction-source-inventory.js';

export function sectionTitles(format){
 if(!['four-panel','side-portrait'].includes(format?.id))throw Error('逐节来源候选仅支持双联/四联，五维模板尚未定义对应schema');
 fixedLayoutSections(format.content);
 const match=/\[1[.．]基础档案\]至\[21[.．]鞋靴\][：:]([^。\n]+)/.exec(format.content||'');
 const titles=match?.[1]?.split('；').map(x=>x.trim());
 if(!titles||titles.length!==21||titles[0]!=='基础档案'||titles[20]!=='鞋靴'||new Set(titles).size!==21)throw Error('本次管理员模板未提供唯一完整0至21节栏目schema，不能使用其他版式标题代替');
 return ['画面要求',...titles];
}

export function validateAndRenderSections(character,variables,format){
 const titles=sectionTitles(format),source=String(variables?.['章节正文']||''),projectStyle=String(variables?.['项目画风']||'');
 if(!Array.isArray(character?.sectionProvenance)||character.sectionProvenance.length!==22)throw Error(`角色${character?.name||''}必须提供0至21节共22项sectionProvenance`);
 const seen=new Set(),rows=[],facts=[],suggestions=[],spans=[];
 for(const entry of character.sectionProvenance){
  if(!entry||!Number.isSafeInteger(entry.section)||entry.section<0||entry.section>21||seen.has(entry.section))throw Error(`角色${character.name}的sectionProvenance编号无效或重复`);
  seen.add(entry.section);
  if(!Array.isArray(entry.sourceFacts)||!Array.isArray(entry.suggestions)||!entry.suggestions.every(s=>typeof s==='string'&&s.trim()))throw Error(`角色${character.name}第${entry.section}节必须有sourceFacts与suggestions数组`);
  for(const suggestion of entry.suggestions)if(isSectionSuggestionPlaceholder(suggestion,titles[entry.section]))throw Error(`角色${character.name}第${entry.section}节建议仅重复栏目或空泛占位，须提供具体设计或留空表示正文未明确`);
  const sectionFacts=[];
  for(const fact of entry.sourceFacts){
   if(!fact||typeof fact.text!=='string'||!fact.text.trim())throw Error(`角色${character.name}第${entry.section}节原文事实不能为空`);
   if(fact.sourceKind==='projectStyle'){
    if(entry.section!==0||!projectStyle||fact.text!==projectStyle)throw Error('项目画风来源只允许第0节且逐字等于提交的项目画风');
    sectionFacts.push('【项目画风】'+fact.text);facts.push(fact.text);continue;
   }
   if(fact.sourceKind&&fact.sourceKind!=='chapterText')throw Error('角色0至21节不接受其他来源种类，固定排版由宿主追加');
   const span=locateSourceQuote(source,fact.quote,fact.occurrence);
   if(!fact.quote.includes(fact.text))throw Error(`角色${character.name}第${entry.section}节事实不是其原文引文的连续子串`);
   sectionFacts.push('【原文事实】'+fact.text);facts.push(fact.text);spans.push({section:entry.section,text:fact.text,quote:fact.quote,occurrence:fact.occurrence,...span});
  }
  if(entry.section===0&&!entry.sourceFacts.some(f=>f.sourceKind==='projectStyle'))throw Error('第0节必须明确引用本次项目画风，不能由模型自行改风格');
  if(entry.suggestions.some(s=>entry.sourceFacts.some(f=>f.text===s)))throw Error('同一节不能将相同内容同时标为事实与建议');
  const suggested=entry.suggestions.map(s=>'【造型建议】'+s);suggestions.push(...entry.suggestions);
  rows.push({section:entry.section,text:`[${entry.section}.${titles[entry.section]}]`+[...sectionFacts,...suggested].join('；')+(sectionFacts.length||suggested.length?'':'正文未明确')});
 }
 return {multiViewPrompt:rows.sort((a,b)=>a.section-b.section).map(r=>r.text).join('\n'),visualProvenance:{sourceFacts:[...new Set(facts)],suggestions:[...new Set(suggestions)]},sectionReview:{status:'host-rendered-facts-and-suggestions',sectionCount:22,verifiedSourceSpans:spans,requiresHumanReview:true,reason:'只验证引文及逐字子串，并由宿主生成归属标签；上下文否定、人物归属与全文穷尽仍需人工核对。'}};
}

export function isSectionSuggestionPlaceholder(suggestion,title){
 const strip=s=>String(s||'').normalize('NFKC').replace(/【[^】]*】/g,'').replace(/^(?:造型建议|视觉补全建议|建议)\s*[：:]?/,'').replace(/[\s，。；：、,.;:!！?？]/g,'').trim();
 const text=strip(suggestion),label=strip(title);
 if(!text||/^(?:正文未明确|未知|待补充|待填写|同上|略|TODO|TBD|适当设计|根据项目风格设计|符合角色身份)$/.test(text))return true;
 // Derive empty descriptors from this template's own title rather than a
 // domain-specific hair/nose/fabric keyword list. Mixed partial titles are
 // reviewed by humans instead of being guessed as generic by this heuristic.
 if(label&&[label,label+'设计',label+'设定',label+'细节',label+'描述',label+'的设计',label+'的设定',label+'的细节'].includes(text))return true;
 return false;
}

export function normalizeSectionProvenance(data,variables,format){
 // Free-form multiViewPrompt is deliberately discarded, never used as trusted output.
 const normalized={...data,characters:(data.characters||[]).map(c=>({...c,...validateAndRenderSections(c,variables,format)}))};
 return annotateResult(normalized,format);
}

export function restoreSectionSidecars(parsed,raw,variables,format){
 const key=value=>String(value??'').normalize('NFKC').trim();
 const hasStructured=raw.some(c=>Object.hasOwn(c||{},'sectionProvenance'));
 if(hasStructured&&(!variables||!format))throw Error('逐节来源数据必须结合提交时正文和模板重验，不能盲目恢复sidecar');
 const rawByName=new Map();
 for(const c of raw){const name=key(c?.name);if(!rawByName.has(name))rawByName.set(name,[]);rawByName.get(name).push(c);}
 if(hasStructured&&parsed.length!==raw.length)throw Error('legacy角色解析器丢失或合并了逐节来源角色，不能任意关联');
 return parsed.map(c=>{
  // Even a mock/future parser that happens to retain model-supplied review must
  // not make it trusted. Only this host recomputation may create sectionReview.
  const {sectionReview:_untrustedReview,sectionProvenance:_parsedSidecar,...legacy}=c;
  const candidates=rawByName.get(key(c.name))||[];
  if(!hasStructured)return legacy;
  if(candidates.length!==1)throw Error(`逐节来源角色${c.name}主名称缺失或不唯一，不能按别名或顺序绑定`);
  const original=candidates[0];
  if(!Array.isArray(original.sectionProvenance))throw Error(`角色${c.name}缺少逐节来源结构，不能混用未核验自由提示词`);
  const restored={...legacy,sectionProvenance:structuredClone(original.sectionProvenance)};
  return {...restored,...validateAndRenderSections(restored,variables,format)};
 });
}

export function sectionContractRules(format,variables){
 const titles=sectionTitles(format);
 const example={section:2,sourceFacts:[{text:'原文逐字子串',quote:'包含该text的真实原文片段',occurrence:1,sourceKind:'chapterText'}],suggestions:['正文没有提供的视觉设计建议']};
 return `【逐节来源候选合同v7sections】本次每个characters项必须有sectionProvenance共22项，section为0至21且各出现一次。栏目schema：${JSON.stringify(titles.map((title,section)=>({section,title})))}。每项结构如${JSON.stringify(example)}。sourceFacts每个text必须是其quote中连续逐字子串，quote必须真实出自本次正文，occurrence从1计。无法逐字支持的五官、材质、年龄细化、身高、服装设计只能放suggestions；不能为了正文丰富而写到sourceFacts。第0节sourceFacts必须且只能以sourceKind=projectStyle、text=${JSON.stringify(String(variables?.['项目画风']||''))}引用本次项目画风；其它节只能chapterText。空facts与空suggestions允许，宿主显示正文未明确。multiViewPrompt仅保留字符串空值或“宿主根据sectionProvenance生成”，它不是可信实际提示词，宿主丢弃并按栏目和归属标签重建，再追加管理员固定排版。不要输出另一个自由长段覆盖结构。顶层仍保留characters/scenes/props/sourceInventory及所有资产身份字段；场景12节、道具纯白三视图、原文资产引文映射合同不变。场景/道具visualProvenance仍完整；人物visualProvenance可供参考但宿主最终只从逐节结构汇总。最终只输出完整JSON，不省略任何节。`;
}
