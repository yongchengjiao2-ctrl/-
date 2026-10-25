import{jsonrepair}from './vendor/jsonrepair/regular/jsonrepair.js';
// Continue only an unfinished JSON document. Each suffix is appended verbatim;
// validation and candidate persistence happen only after the whole document parses.
export function unfinishedJSON(text){
 let source=text.trim().replace(/^```(?:json)?\s*/i,'');
 if(!source.startsWith('{'))return false;
 let stack=[],string=false,escape=false;
 for(const ch of source){
  if(string){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch==='"')string=false;continue;}
  if(ch==='"')string=true;
  else if(ch==='{'||ch==='[')stack.push(ch);
  else if(ch==='}'||ch===']'){if(stack.pop()!==(ch==='}'?'{':'['))return false;}
 }
 return string||stack.length>0;
}
export async function completeExtraction(initial,{validate,request,maxContinuations=4}){
 let text=initial.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
 for(let attempt=0;;attempt++){
  try{validate(text);return text;}catch(error){
   if(!unfinishedJSON(text))throw error;
   if(attempt>=maxContinuations)throw Error('资产响应多次截断，尚未形成完整JSON；已有资产保留，请换用支持长输出的模型。');
   const suffix=await request(text,attempt+1);
   if(typeof suffix!=='string'||!suffix.length)throw Error('资产续传返回空内容，已有资产保留。');
   text+=suffix.replace(/^```(?:json)?\s*\r?\n/i,'').replace(/\r?\n```\s*$/,'');
  }
 }
}

export function parseExtractionJSON(raw){
 let text=raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
 // Repair only a missing opening quote on a known property at the beginning of a JSON line.
 text=text.replace(/^(\s*)(name|aliases|role|appearance|physique|clothing|personality|props|consistencyPrompt|multiViewPrompt|voiceLanguage|voiceAge|voiceTimbre|description|prompt)"\s*:/gm,'$1"$2":');
 text=text.replace(/,\s*"{2,}\s*(?=[}\]])/g,'');
 let data;
 try{data=JSON.parse(text);}catch(error){
  if(unfinishedJSON(text))throw Error(`模型响应被截断：已收到${text.length}字符，JSON字符串或括号未闭合，资产未保存。`);
  try{data=JSON.parse(jsonrepair(text));}catch{throw Error(`JSON语法错误：${error.message}`);}
 }
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('JSON顶层必须为对象');
 for(const key of ['characters','scenes','props'])if(!Array.isArray(data[key]))throw Error(`JSON字段${key}必须为数组`);
 return data;
}
