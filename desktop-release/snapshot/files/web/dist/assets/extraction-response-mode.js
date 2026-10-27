export const RESPONSE_MODE_KEY='yingce.asset-extraction.response-mode.v1';
export function extractionStream(storage=globalThis.localStorage){
 try{return storage?.getItem(RESPONSE_MODE_KEY)==='stream';}catch{return false;}
}
export function ResponseModePicker({react:React}){
 const h=React.createElement;
 const [stream,setStream]=React.useState(()=>extractionStream());
 const [error,setError]=React.useState('');
 return h('section',{'aria-label':'提取返回方式',style:{display:'grid',gap:6}},
 h('label',null,'返回方式',h('select',{'aria-label':'选择流式或非流式',value:stream?'stream':'complete',style:{width:'100%',padding:8,border:'1px solid #8886',borderRadius:6,background:'var(--background,white)',color:'inherit'},onChange:e=>{
  const next=e.target.value==='stream';try{localStorage.setItem(RESPONSE_MODE_KEY,next?'stream':'complete');setStream(next);setError('');}catch{setError('返回方式保存失败，请重试');}
 }},h('option',{value:'complete'},'非流式（默认）'),h('option',{value:'stream'},'流式'))),
 h('p',{style:{fontSize:12,opacity:.65,margin:0}},'非流式：等待模型一次性返回。流式：逐段接收。两种方式均在完整数据校验通过并保存后确认提取完成；资产仍需在“角色与资产”中确认。'),
 error?h('p',{role:'alert'},error):null);
}
