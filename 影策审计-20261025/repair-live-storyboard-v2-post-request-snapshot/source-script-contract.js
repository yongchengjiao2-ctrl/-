// Independent source ledger shared by generation and commit validation.
// It never derives the expected speech/coverage from the model's own result.
export function sourcePlainText(value){
 return String(value||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:p|div|h\d)>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\r\n?/g,'\n').trim();
}
const metadata=/^(?:场次|场景|人物|时间|天气(?:\/环境)?|环境|地点|镜头|机位|景别|运镜|画面|音效|声效|音乐|BGM|BPM|配音指令|声纹绑定|身份(?:\/等级)?|章节|标题|时长|(?:本场|本段|本章)?预计时长|提示|说明|注意|备注|要求|限制|约束|配音指导|台词说明)[：:]/i;
const unbracketLabel=line=>line.replace(/^【([^】\n]{1,40})】\s*([：:])/,'$1$2');
export function isSourceStageDirection(line){return /^[（(][\s\S]*[）)]$/.test(line.trim());}
export function isSourceMetadata(line){return !line||metadata.test(unbracketLabel(line))||/^(?:👤|🔖|🎙|[-—]{3,}|《第|（本集|\(本集|\(?配音指令)/.test(line)||line.startsWith('【')&&!speechLine(line);}
export function speechLine(line){
 line=unbracketLabel(line);
 if(line.startsWith('【'))return null;
 // A colon in a speaker's stage direction is not the speech delimiter.
 let depth=0,index=-1;
 for(let i=0;i<line.length;i++){
  if(/[（(]/.test(line[i]))depth++;
  else if(/[）)]/.test(line[i]))depth=Math.max(0,depth-1);
  else if(/[：:]/.test(line[i])&&!depth){index=i;break;}
 }
 if(index<0)return null;
 const prefix=line.slice(0,index).trim();
 const speaker=prefix.split(/[（(]/)[0].trim();
 if(!speaker||speaker.length>40||/[。！？!?；;]/.test(speaker)||metadata.test(line))return null;
 const mode=/[（(]\s*(OS|VO|OV)\s*[）)]/i.exec(prefix)?.[1]?.toUpperCase()||(/^(?:OS|VO|OV)$/i.test(speaker)?speaker.toUpperCase():speaker==='旁白'?'旁白':'对白');
 return {speaker,prefix,mode,voice:line.slice(index+1).replace(/^\s*[（(](?:哼唱调|低声|高声)[^）)]*[）)]/,'')};
}
export function sourceScriptContract(source){
 const text=sourcePlainText(source),structured=/(?:^|\n)\s*(?:△(?:画面|转场)[：:]|场次[：:]|场景[：:]|人物[：:]|【[^】\n]{1,40}】[：:]|(?:旁白|对白|OS|VO|OV)(?:[（(][^）)]*[）)])?[：:]|[^\n：:]{1,20}[（(](?:OS|VO|OV)[）)][：:])/.test(text);
 if(!structured)return {text,structured:false,voice:text,beats:0,speeches:[],visualBeats:[],unclassified:[],diagnostics:[]};
 const speeches=[],visualBeats=[],unclassified=[],diagnostics=[];let beats=0,active=null;
 for(const raw of text.split('\n')){
  const line=raw.trim();
  if(/^△(?:画面|转场)[：:]/.test(line)){beats++;visualBeats.push({beat:beats,visual:line});active=null;continue;}
  if(isSourceStageDirection(line)){if(beats)visualBeats.at(-1).visual+='\n'+line;else unclassified.push(line);active=null;continue;}
  if(isSourceMetadata(line)){
   // Notes and bracketed screen/interface text belong to the current visual
   // context, not to a fictitious speaker. Scene/roster/time stay metadata.
   if(beats&&(/^(?:提示|说明|注意|备注|要求|限制|约束|配音指导|台词说明)[：:]/.test(unbracketLabel(line))||line.startsWith('【')))visualBeats.at(-1).visual+='\n'+line;
   if(line)active=null;continue;
  }
  const speech=speechLine(line);
  if(speech){active={...speech,beat:beats};speeches.push(active);continue;}
  if(active){active.voice+='\n'+raw;diagnostics.push({code:'unlabelled-speech-continuation',text:line,message:'此无标签行按上一发言续行处理；若是动作，请使用整行括号或△画面标记。'});continue;}
  if(beats)visualBeats.at(-1).visual+='\n'+line;
  else{unclassified.push(line);diagnostics.push({code:'unclassified-before-first-beat',text:line,message:'首个画面之前的无标签内容未归入配音或画面，请标明用途。'});}
 }
 return {text,structured:true,voice:speeches.map(s=>s.voice).join(''),beats,speeches,visualBeats,unclassified,diagnostics};
}
const withoutWhitespace=value=>String(value||'').replace(/\s/g,'');
export function assertSourceFidelity(rows,source){
 const contract=sourceScriptContract(source);
 if(withoutWhitespace(contract.voice)!==withoutWhitespace(rows.map(r=>r.dialogue||'').join('')))throw Error('分镜配音未完整保留原文或增加了原文没有的配音，已阻止写入。');
 if(contract.beats){
  const covered=new Set();
  for(let i=0;i<rows.length;i++){
   const beats=rows[i].sourceBeats;
   if(!Array.isArray(beats)||!beats.length)throw Error(`第${i+1}段sourceBeats必须标明实际覆盖的原画面，已阻止写入。`);
   if(beats.some(n=>!Number.isInteger(n)||n<1||n>contract.beats)||new Set(beats).size!==beats.length)throw Error(`第${i+1}段sourceBeats包含重复、非整数或越界原画面编号，已阻止写入。`);
   for(const n of beats)covered.add(n);
  }
  const missing=Array.from({length:contract.beats},(_,i)=>i+1).filter(n=>!covered.has(n));
  if(missing.length)throw Error(`分镜遗漏原画面${missing.join('、')}，已阻止写入。`);
 }
 return contract;
}
