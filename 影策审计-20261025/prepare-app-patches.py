import pathlib,os,json,hashlib
root=pathlib.Path(__file__).parent;src=root.parent/'character-prompt-formats/src';assets=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/versions/1.3.13/web/dist/assets'
records=[]
for name in ['assets-BpSjmEjz.js','project-B6TxOaS-.js','user-data-sync-B6hrlYAn.js','workflow-production-workbench-DLsty33y.js']:
 p=assets/name;s=p.read_text('utf8');before=s
 if name=='assets-BpSjmEjz.js':
  old='let t=He(e.name,e.definition),n=Wt(e.name,e.definition,e.projectStyle)'
  new='let t=He(e.name,e.definition)||RFAuditCharacterImage(e.name,e.definition,e.projectStyle),n=Wt(e.name,e.definition,e.projectStyle)'
  assert s.count(old)==1;s=s.replace(old,new,1)
  old='prompt:He(e.name,e.definition)||ze(`角色三视图`)';assert s.count(old)==1;s=s.replace(old,'prompt:t',1)
  old='promptTemplateOperation:t?void 0:B.CharacterTurnaround,promptTemplateVariables:t?void 0:n';assert s.count(old)==1;s=s.replace(old,'promptTemplateOperation:void 0,promptTemplateVariables:void 0',1)
  s='import{characterImagePrompt as RFAuditCharacterImage}from"./character-image-contract.js";'+s
 elif name=='workflow-production-workbench-DLsty33y.js':
  old='try{let n=await S.validateFields(),r=c;'
  new='try{let n=await S.validateFields();if(R===`video`&&String(n.videoPrompt||``).includes(`【素材引用待核对】`))throw Error(`素材引用存在未解决歧义，请明确实际素材后再生成视频。`);let r=c;'
  assert s.count(old)==1;s=s.replace(old,new,1)
 else:
  assert '已保存到云端' in s;s=s.replace('已保存到云端','已保存到本机工作台')
 (src/name).write_text(s,encoding='utf8')
 records.append({'file':name,'installedBeforeSha256':hashlib.sha256(before.encode()).hexdigest(),'preparedSha256':hashlib.sha256(s.encode()).hexdigest()})
(root/'compiled-patch-baseline.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf8')
print('Prepared',len(records),'compiled module patches; not installed')
