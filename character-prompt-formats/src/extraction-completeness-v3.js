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
   if(/[（(]/.test(name))name=name.split(/[（(]/).at(-1);
   if(name&&!/^无|^历史意象/.test(name))people.push(name==='旁听席'?'旁听群众':name);
  }
 }
 if(/旁听席|旁听群众/.test(source))people.push('旁听群众');
 if(/各界群众/.test(source))people.push('各界群众');
 const scenes=[];
 for(const match of source.matchAll(/场景[：:]([^\n]*?)(?=时间[：:]|\n|$)/g)){
  for(const scene of match[1].split(/[与、]/))if(scene.trim())scenes.push(scene.trim());
 }
 if(/法院大门|走出法院|法院铁门/.test(source))scenes.push('法院大门外');
 return {people:[...new Set(people)],scenes:[...new Set(scenes)]};
}
const canonical=value=>String(value).replace(/[\s·•（）()【】]/g,'').replace(/天津(?:地方)?/g,'').replace(/全景远眺|群像|席|代表|群众/g,'');
export function assertSourceCoverage(data,variables){
 const expected=sourceCoverage(variables),errors=[];
 for(const name of expected.people){
  const token=canonical(name);
  if(!data.characters.some(a=>[a.name,...(a.aliases||[])].some(v=>canonical(v).includes(token))))errors.push('角色独立建卡：'+name);
 }
 const used=new Set();
 for(const scene of expected.scenes){
  let token=canonical(scene);
  const index=data.scenes.findIndex((a,i)=>!used.has(i)&&(scene==='法院大门外'?/法院.*(?:门|外)/.test(a.name):canonical(a.name).includes(token)));
  if(index<0)errors.push('场景独立建卡：'+scene);else used.add(index);
 }
 if(errors.length)throw Error('正文资产覆盖不完整；'+errors.join('；'));
}
export function coverageRules(variables){
 const expected=sourceCoverage(variables);
 return '\n【根据正文标签核对的资产清单】'+JSON.stringify(expected)+'。清单名称只用于对应正文，不得漏项。每个人物身份/群体各有独立角色条目；正文可见的不同身份群体不能并入主角。不同空间分别建立场景条目，不允许一个合并场景占用两个清单项。道具按正文中的内容、用途和版本差异分别制作，不合并不同文件或不同标语。人物的完整形象不能只写一句版式；四联/双联必须逐项填写0至21节（22至24由应用补全），不得遗漏标题。';
}

export function assertFormatCompleteness(data,format){
 if(!['four-panel','side-portrait'].includes(format?.id))return;
 for(const character of data.characters){
  const prompt=String(character.multiViewPrompt||'');
  for(let section=0;section<=21;section++)if(!new RegExp('\\['+section+'[.．]').test(prompt))throw Error(`角色${character.name}的multiViewPrompt缺少第${section}节，必须填写0至21节全部具体设定`);
 }
}
