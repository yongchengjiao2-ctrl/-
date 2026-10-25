// Browsers omit image/canvas based mention chips from native text/plain copying.
export function mentionPlainText(node,references=[]){
 if(node.nodeType===3)return node.textContent||'';
 const token=node.dataset?.mentionToken;
 if(token){
  const id=/^@\[(?:asset|node|skill|text):([^\]]+)\]$/.exec(token)?.[1];
  const ref=references.find(r=>[r.assetId,r.nodeId,r.id,r.skill?.skillId].some(value=>value===id||value===`project-asset:${id}`||value===`skill:${id}`));
  const label=ref?.label||ref?.title||node.dataset?.mentionLabel;
  return label?'@'+label:token;
 }
 if(node.nodeName==='BR')return '\n';
 return Array.from(node.childNodes||[]).map(n=>mentionPlainText(n,references)).join('');
}
export function copyMentionSelection(event,root,references=[]){
 const selection=root.ownerDocument?.defaultView?.getSelection();
 if(!selection?.rangeCount||selection.isCollapsed||!event.clipboardData)return false;
 const range=selection.getRangeAt(0);
 if(!root.contains(range.startContainer)||!root.contains(range.endContainer))return false;
 const text=mentionPlainText(range.cloneContents(),references);
 event.clipboardData.setData('text/plain',text);event.preventDefault();return true;
}
