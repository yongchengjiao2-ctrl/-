// Request-local policy. Never change a configured provider to another provider.
const JSON_CHAT_PROTOCOLS=new Set(['a6api-chat','yingce-asset-json-chat','chat-completion']);
export function textRequestPolicy(config,{responseFormat={type:'json_object'}}={}){
 const selected=config.textModel||config.model;
 if(typeof selected!=='string'||!selected.trim())throw Error('请选择文本模型');
 const divider=selected.indexOf('::'),channelId=divider<0?null:selected.slice(0,divider),model=divider<0?selected:selected.slice(divider+2);
 const candidates=(config.channels||[]).filter(c=>channelId?c.id===channelId:c.models?.includes(model));
 if(candidates.length!==1)throw Error(candidates.length?'文本模型存在多个同名渠道，请明确选择渠道':'所选文本渠道不存在，请重新选择模型');
 const channel=candidates[0];if(channel.enabled===false)throw Error('所选文本渠道已停用');
 const cost=channel.modelCosts?.find(c=>c.model===model);
 const protocol=cost?.protocol?.trim()||channel.interfaceType?.trim()||null;
 const logical=!!cost?.logicalModelId||channel.scope==='system';
 // A server-routed logical model is resolved by the server, not this patch.
 if(logical)return {config:{...config,model:selected,textModel:selected},providerOptions:{},diagnostic:{protocol,logical:true,stream:false}};
 if(!protocol)throw Error('文本渠道未配置协议，请在接口渠道选择已安装的文本协议');
 const defaults={...(cost?.defaultOptions||{})};
 const options={...defaults,stream:false};
 if(JSON_CHAT_PROTOCOLS.has(protocol)){
  options.response_format=responseFormat;
  // Keep explicit token limits; do not demand a model-specific maximum globally.
  if(protocol==='yingce-asset-json-chat'&&options.max_tokens==null)options.max_tokens=65536;
  if(protocol==='yingce-asset-json-chat'&&model.toLowerCase().includes('deepseek')&&options.thinking==null)options.thinking={type:'disabled'};
 }
 const modelCosts=[...(channel.modelCosts||[]).filter(x=>x.model!==model),{...cost,model,protocol,defaultOptions:options}];
 const next={...config,model:selected,textModel:selected,channels:config.channels.map(c=>c===channel?{...c,modelCosts}:c)};
 return {config:next,providerOptions:{[protocol]:options},diagnostic:{protocol,logical:false,stream:false,structuredOutput:JSON_CHAT_PROTOCOLS.has(protocol)}};
}
export function textRequestMetadata(config,options){
 const policy=textRequestPolicy(config,options);
 return {responseMode:'non-stream',requestedStream:false,providerOptions:policy.providerOptions,textRequestPolicy:policy.diagnostic};
}
