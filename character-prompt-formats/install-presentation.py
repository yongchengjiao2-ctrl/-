from _audit_install_guard import guard_legacy_install
guard_legacy_install(__file__, allow_build_only=False)
import os,pathlib,shutil,subprocess
root=pathlib.Path(__file__).resolve().parent
assets=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/versions/1.3.13/web/dist/assets'
shutil.copy2(root/'src/storyboard-template-standard.js',assets/'storyboard-template-standard.js')
shutil.copy2(root/'src/shot-asset-bindings.js',assets/'shot-asset-bindings.js')
for name in ['workflow-shot-references-CRoK17V2.js','chapters-CeKTBaiU.js']:
 p=assets/name;s=p.read_text('utf8');out=s
 if name.startswith('workflow') and 'bindPrompt as RFFormat' not in s:
  out=s.replace('augmentReferences as RFAugment','augmentReferences as RFAugment,bindPrompt as RFFormat',1)
  a=out.index('function w(e,t){');b=out.index('function T(e){',a)
  out=out[:a]+'function w(e,t){return RFFormat(e,t.map(r=>({...r,id:r.assetId,title:r.title||r.label})))}'+out[b:]
 if name.startswith('chapters') and 'PRESENTATION_RULES as RFPresentationRules' not in s:
  out=s.replace('repairStoredProject as RFRepair','repairStoredProject as RFRepair,PRESENTATION_RULES as RFPresentationRules',1)
  anchor='a=L(i.prompt)+'
  if out.count(anchor)!=1:raise RuntimeError('Unexpected chapter prompt')
  out=out.replace(anchor,'a=L(i.prompt)+RFPresentationRules+',1)
 stage=root/'build'/('presentation-'+name);stage.write_text(out,encoding='utf8');subprocess.run(['node','--check',str(stage)],check=True)
 if out!=s:
  backup=root/'backups'/('before-presentation-'+name)
  if not backup.exists():shutil.copy2(p,backup)
  if p.read_text('utf8')!=s:raise RuntimeError('Concurrent modification')
  temp=p.with_suffix('.js.tmp');shutil.copy2(stage,temp);temp.replace(p)
print('Installed asset introductions, inline references and shot timing labels.')
