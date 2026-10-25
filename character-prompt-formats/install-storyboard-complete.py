from _audit_install_guard import guard_legacy_install
guard_legacy_install(__file__, allow_build_only=False)
import os,pathlib,datetime,subprocess,shutil
root=pathlib.Path(__file__).resolve().parent
assets=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/versions/1.3.13/web/dist/assets'
p=assets/'chapters-CeKTBaiU.js';original=p.read_text('utf8');text=original
if 'completeConfig as RFCompleteConfig' not in text:
 prefix='import{completeConfig as RFCompleteConfig,completeMetadata as RFCompleteMetadata,COMPLETE_RULES as RFCompleteRules,catalogRules as RFCatalogRules,outputGuide as RFOutputGuide,waitComplete as RFWaitComplete}from"./storyboard-complete.js";'
 start=text.index('async function bn(');end=text.index('async function xn(',start);block=text[start:end]
 def once(a,b):
  global block
  assert block.count(a)==1,(a,block.count(a));block=block.replace(a,b,1)
 once('r={...e.config,model:n}','r=RFCompleteConfig({...e.config,model:n})')
 once('a=L(i.prompt)+RFPresentationRules+','a=L(i.prompt)+RFPresentationRules+RFCompleteRules+RFCatalogRules(e.referenceCatalog||e.assets)+')
 once('config:it(r,`text`),metadata:', 'config:it(r,`text`),textOptions:{stream:!1,thinking:!1},metadata:')
 once('...i.metadata}}}', '...i.metadata,...RFCompleteMetadata(n)}}}')
 once('await st(o.id,{initialTask:o,useTextEvents:!0,onTaskUpdate:t?.onTaskUpdate})','await RFWaitComplete(o.id,{initialTask:o,queryTask:ot,onTaskUpdate:t?.onTaskUpdate})')
 text=prefix+text[:start]+block+text[end:]
 text=text.replace('repairStoredProject as RFRepair,','referenceCatalog as RFReferenceCatalog,repairStoredProject as RFRepair,',1)
 anchor='characters:en(e,n.id),assets:tn(e),config:s,skills:et'
 assert text.count(anchor)==1
 text=text.replace(anchor,'characters:en(e,n.id),assets:tn(e),referenceCatalog:RFReferenceCatalog(e),config:s,skills:et',1)
 stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S');shutil.copy2(p,root/'backups'/('chapters-before-storyboard-complete-'+stamp+'.js'))
 stage=root/'build'/'chapters-storyboard-complete.js';stage.write_text(text,encoding='utf8');subprocess.run(['node','--check',str(stage)],check=True)
 shutil.copy2(root/'src/storyboard-complete.js',assets/'storyboard-complete.js');p.write_text(text,encoding='utf8')
 print('Installed chapter storyboard non-stream request and wait without a client deadline.')
else:
 if 'catalogRules as RFCatalogRules' not in text:
  text=text.replace('completeConfig as RFCompleteConfig,','catalogRules as RFCatalogRules,completeConfig as RFCompleteConfig,',1).replace('RFPresentationRules+RFCompleteRules+','RFPresentationRules+RFCompleteRules+RFCatalogRules(e.referenceCatalog||e.assets)+',1).replace('repairStoredProject as RFRepair,','referenceCatalog as RFReferenceCatalog,repairStoredProject as RFRepair,',1)
  text=text.replace('characters:en(e,n.id),assets:tn(e),config:s,skills:et','characters:en(e,n.id),assets:tn(e),referenceCatalog:RFReferenceCatalog(e),config:s,skills:et',1)
  stage=root/'build'/'chapters-storyboard-complete.js';stage.write_text(text,encoding='utf8');subprocess.run(['node','--check',str(stage)],check=True);p.write_text(text,encoding='utf8')
 shutil.copy2(root/'src/storyboard-complete.js',assets/'storyboard-complete.js');print('Already installed; refreshed runtime.')

current=p.read_text('utf8')
if '+RFOutputGuide(e.referenceCatalog||e.assets)' not in current:
 updated=current if 'outputGuide as RFOutputGuide' in current else current.replace('catalogRules as RFCatalogRules,','catalogRules as RFCatalogRules,outputGuide as RFOutputGuide,',1)
 anchor='内部结构按宿主合同返回。`,o=await lt('
 assert updated.count(anchor)==1
 updated=updated.replace(anchor,'内部结构按宿主合同返回。`+RFOutputGuide(e.referenceCatalog||e.assets),o=await lt(',1)
 stage=root/'build'/'chapters-storyboard-complete.js';stage.write_text(updated,encoding='utf8');subprocess.run(['node','--check',str(stage)],check=True)
 shutil.copy2(p,root/'backups'/('chapters-before-final-guide-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'.js'));p.write_text(updated,encoding='utf8')
 print('Installed verified final storyboard format guide.')
