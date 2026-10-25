// Shared by all mounted chapter views. No network retry or second model phase.
const locks=new Map();
export async function oneChapterSubmission(key,run){
 if(locks.has(key))return locks.get(key);
 const promise=Promise.resolve().then(run);locks.set(key,promise);
 try{return await promise;}finally{if(locks.get(key)===promise)locks.delete(key);}
}
export function makeSingleModelTask(createTask){
 let submitted=false;
 return request=>{
  if(submitted)throw Error('本次生成已提交，已阻止重复模型调用。');
  submitted=true;
  if(request.operation!=='text')throw Error('分镜必须走单次文本生成，禁止自动拆段修正。');
  return createTask({...request,input:{...request.input,textOptions:{stream:false,thinking:false},metadata:{...request.input?.metadata,singleModelCall:true,maxModelCalls:1,automaticRepair:false,clientOperationId:globalThis.crypto?.randomUUID?.()||`chapter-${Date.now()}-${Math.random()}`}}});
 };
}
