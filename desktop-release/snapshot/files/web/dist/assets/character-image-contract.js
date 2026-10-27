export function characterImagePrompt(name,definition={},style={}){
 const facts=['role','appearance','physique','clothing','personality','props','consistencyPrompt'].flatMap(key=>{
  const value=definition[key];return typeof value==='string'&&value.trim()?[`${key}：${value.trim()}`]:[];
 });
 if(!facts.length)throw Error('请先填写角色设定，再生成角色形象');
 const styleText=[style?.title,style?.prompt].filter(v=>typeof v==='string'&&v.trim()).join('\n');
 return `生成角色「${String(name||'未命名角色')}」的静态形象设定图。只生成图片，不提取资产、不输出JSON。\n${styleText?`项目画风：\n${styleText}`:'项目未指定画风，保持设定中已有媒介，不自设时代。'}\n角色事实与已有设定：\n${facts.join('\n')}\n同一角色正面、严格侧面、背面完整全身三视图，白色背景，服装和身体比例一致，不裁头脚。未明确的内容只作必要造型建议，不改变已知身份、物种和项目画风。`;
}
