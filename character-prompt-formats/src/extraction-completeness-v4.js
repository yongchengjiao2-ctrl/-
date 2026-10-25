export function assertNamedPeopleSeparate(data,variables){
 const source=String(variables?.['章节正文']||'');
 const expected=[];
 for(const line of source.match(/人物[：:][^\n]+/g)||[]){
  for(const match of line.matchAll(/[（(]([\p{sc=Han}]{2,4}(?:[、，,][\p{sc=Han}]{2,4})+)[）)]/gu))expected.push(...match[1].split(/[、，,]/));
 }
 for(const name of expected)if(!data.characters.some(c=>c.name===name||c.name.endsWith(name)))throw Error(`具名人物${name}必须单独建卡，不能合并为职业群像或其他角色的aliases`);
}

// Derive the coverage checklist from chapter labels; it is never a substitute for the source.
export function sourceCoverage(variables){
 const source=String(variables?.['章节正文']||'');
 const people=[];
 for(const match of source.matchAll(/人物[：:]([\s\S]*?)(?=【本场|场次[：:]|△画面|\n|$)/g)){
  for(let name of match[1].split(/[、，,]/)){
   name=name.trim().replace(/[）)]/g,'');
   if(/[（(]/.test(name)){const parts=name.split(/[（(]/);name=/^(单人|群像|多人|群体|若干|一名)$/.test(parts.at(-1))?parts[0]:parts.at(-1);}
   if(name&&!isExplicitNone(name))people.push(name==='旁听席'?'旁听群众':name);
  }
 }
 if(/旁听席|旁听群众/.test(source))people.push('旁听群众');
 if(/各界群众/.test(source))people.push('各界群众');
 const scenes=[];
 for(const match of source.matchAll(/场景[：:]([^\n]*?)(?=时间[：:]|\n|$)/g)){
  for(const scene of match[1].split(/[与、]/))if(scene.trim()&&!isExplicitNone(scene.trim()))scenes.push(scene.trim());
 }
 if(/法院大门|走出法院|法院铁门/.test(source))scenes.push('法院大门外');
 return {people:[...new Set(people)],scenes:[...new Set(scenes)]};
}
const isExplicitNone=value=>/^(?:无|无人物|无人出场|无出场人物|无角色|无场景|无道具|无可见道具|历史意象(?:定格)?(?:，?无人物)?)$/.test(String(value).trim().replace(/[。；;]$/,''));
// Keep identity-bearing group words: deleting “群众” made its empty token match every person.
const canonical=value=>String(value??'').replace(/[\s·•（）()【】]/g,'').replace(/天津(?:地方)?/g,'').replace(/全景远眺/g,'');
export function coverageAssessment(variables){
 const source=String(variables?.['章节正文']||'').trim(),expected=sourceCoverage(variables);
 const labels={people:/人物[：:]/.test(source),scenes:/场景[：:]/.test(source),props:/道具[：:]/.test(source)};
 const props=[];
 for(const match of source.matchAll(/道具[：:]([^\n]*)/g))for(const item of match[1].split(/[、，,]/)){const name=item.trim();if(name&&!isExplicitNone(name))props.push(name);}
 const missingLabels=Object.entries(labels).filter(([,present])=>!present).map(([key])=>key);
 const status=source&&labels.people&&labels.scenes?'labeled-partial':'unverified';
 return {status,reason:status==='unverified'?'普通小说或缺少可核对的人物/场景标签；必须人工核对，不能据空清单宣称提取完整。':'仅核对显式标签；未标签的正文资产仍需人工核对。',checkedScopes:Object.entries(labels).filter(([,present])=>present).map(([key])=>key),expected:{...expected,props:[...new Set(props)]},labels,missingLabels,scope:'仅核对正文显式资产标签；不是自然语言全文完整性证明'};
}
export function assertSourceCoverage(data,variables){
 const assessment=coverageAssessment(variables),expected=assessment.expected,errors=[];
 for(const name of expected.people){
  const token=canonical(name);
  if(!token||!data.characters.some(a=>[a.name,...(a.aliases||[])].some(v=>{const candidate=canonical(v);return candidate&&candidate.includes(token);})))errors.push('角色独立建卡：'+name);
 }
 const used=new Set();
 for(const scene of expected.scenes){
  let token=canonical(scene);
  const index=token?data.scenes.findIndex((a,i)=>!used.has(i)&&(scene==='法院大门外'?/法院.*(?:门|外)/.test(a.name):canonical(a.name).includes(token))):-1;
  if(index<0)errors.push('场景独立建卡：'+scene);else used.add(index);
 }
 for(const name of expected.props){const token=canonical(name);if(!token||!data.props?.some(a=>canonical(a.name).includes(token)))errors.push('道具独立建卡：'+name);}
 if(errors.length)throw Error('正文资产覆盖不完整；'+errors.join('；'));
 const emptyResult=!data.characters?.length&&!data.scenes?.length&&!data.props?.length;
 return {...assessment,requiresHumanReview:true,...emptyResult?{emptyResult:true,reason:'模型未提取任何资产；不能据此断言正文无资产，必须人工核对。'}:{}};
}
export function coverageRules(variables){
 const assessment=coverageAssessment(variables),expected=assessment.expected;
 return '\n【根据正文标签核对的资产清单】'+JSON.stringify(expected)+'。'+assessment.scope+'；未列出的正文资产仍须提取，不能把空清单当成无资产。清单名称只用于对应正文，不得漏项。每个人物身份/群体各有独立角色条目；正文可见的不同身份群体不能并入主角。不同空间分别建立场景条目，不允许一个合并场景占用两个清单项。道具按正文中的内容、用途和版本差异分别制作，不合并不同文件或不同标语。人物的完整形象不能只写一句版式；四联/双联必须逐项填写0至21节（22至24由应用补全），不得遗漏标题。';
}

export function assertFormatCompleteness(data,format){
 if(!['four-panel','side-portrait'].includes(format?.id))return;
 for(const character of data.characters){
  const prompt=String(character.multiViewPrompt||'');
  const sections=[...prompt.matchAll(/^[ \t]*\[(\d+)[.．]([^\]\n]*)\][ \t]*[：:]?/gm)];
  for(let section=0;section<=21;section++){
   const matches=sections.filter(m=>Number(m[1])===section);
   if(!matches.length)throw Error(`角色${character.name}的multiViewPrompt缺少第${section}节，必须填写0至21节全部具体设定`);
   if(matches.length!==1)throw Error(`角色${character.name}的multiViewPrompt第${section}节重复，不能确定有效内容`);
   const match=matches[0],next=sections.find(m=>m.index>match.index),[title,...inline]=match[2].split(/[：:]/),body=[inline.join('：'),prompt.slice(match.index+match[0].length,next?.index??prompt.length)].join('').trim();
   if(!title.trim()||!/[\p{L}\p{N}]/u.test(body)||/^(?:待补充|待填写|略|同上|TODO|TBD|N\/A|无内容|\.\.\.|…)[。.!！\s]*$/i.test(body))throw Error(`角色${character.name}的multiViewPrompt第${section}节内容为空或占位，必须填写具体设定或明确正文未明确`);
  }
 }
}
