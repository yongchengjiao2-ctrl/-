export function reviewIssues(raw,plan,error){
 const issues=[error.message];const found=new Map((raw?.segments||[]).map(s=>[s.id,s]));
 for(const p of plan.segments){const d=found.get(p.id);if(!d){issues.push(`缺少第${p.id}段；对应原文话语：${p.voice||'本段无台词，为必要动作'}`);continue;}for(let j=0;j<p.shots.length;j++)if(!d.shots?.[j])issues.push(`第${p.id}段缺少镜头${j+1}；对应话语：${p.shots[j].voice||'必要动作'}`);}
 return [...new Set(issues)];
}
export function keepReviewDraft(context,text,issues,storage=globalThis.localStorage){
 const draft={id:globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),projectId:context.projectId,chapterId:context.chapterId,text,issues,createdAt:new Date().toISOString(),status:'待人工复核',persisted:false};
 try{const key='yingce-storyboard-review-drafts',existing=storage.getItem(key)||'[]';if(existing.length>2_000_000)throw Error('待复核存储已达到容量上限，请下载备份并人工整理');const all=JSON.parse(existing);if(!Array.isArray(all))throw Error('待复核存储格式异常，未覆盖旧数据');const serialized=JSON.stringify([...all,{...draft,persisted:true}]);if(serialized.length>2_000_000||all.length>=100)throw Error('待复核存储已达到容量上限，请下载备份并人工整理');storage.setItem(key,serialized);draft.persisted=true;}catch(error){draft.storageError=error.message||'本机存储不可用';}return draft;
}
export function showReviewDraft(draft,{signal}={}){return new Promise((resolve,reject)=>{
 if(signal?.aborted){reject(new DOMException('Aborted','AbortError'));return;}
 const dialog=document.createElement('dialog');dialog.style.cssText='width:min(920px,90vw);max-height:90vh;border:1px solid #ddd;border-radius:12px;padding:24px;color:#172033;background:white';
 const title=document.createElement('h2');title.textContent=draft.persisted?'分镜待人工复核：当前输出已保存在本机':'分镜待人工复核：当前输出仅保留在此窗口，请下载';dialog.append(title);
 const note=document.createElement('p');note.textContent=draft.persisted?'草稿已保存在本机。现有正式分镜保持不变；重新生成会发起一次新的模型请求。':'本机存储失败，请先下载当前输出。现有正式分镜保持不变。';dialog.append(note);
 const list=document.createElement('ul');for(const issue of draft.issues){const li=document.createElement('li');li.textContent=issue;list.append(li);}dialog.append(list);
 const text=document.createElement('textarea');text.readOnly=true;text.value=draft.displayText||draft.text;text.style.cssText='width:100%;height:40vh;box-sizing:border-box';text.setAttribute('aria-label','当前完整原始输出');dialog.append(text);
 const controls=document.createElement('div');controls.style.cssText='display:flex;gap:12px;margin-top:18px';dialog.append(controls);
 let settled=false;const finish=(choice,error)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);if(dialog.open)dialog.close();dialog.remove();error?reject(error):resolve(choice);};
 const abort=()=>finish(null,new DOMException('Aborted','AbortError'));signal?.addEventListener('abort',abort,{once:true});
 for(const [label,choice]of [['下载当前输出','download'],['我知道了','ack'],['重新生成','retry']]){const button=document.createElement('button');button.textContent=label;button.style.cssText='padding:10px 18px;cursor:pointer';button.onclick=()=>{if(choice==='download'){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}));a.href=url;a.download='分镜待复核-'+draft.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}else finish(choice);};controls.append(button);}
 dialog.addEventListener('cancel',e=>{e.preventDefault();finish('ack');});dialog.addEventListener('close',()=>finish('ack'));try{document.body.append(dialog);dialog.showModal();}catch(error){finish(null,error);}
});}
