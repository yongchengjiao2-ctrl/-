from _audit_install_guard import guard_legacy_install
guard_legacy_install(__file__, allow_build_only=False)
import pathlib,os,datetime,shutil,subprocess
root=pathlib.Path(__file__).resolve().parent;assets=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/versions/1.3.13/web/dist/assets';stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
p=assets/'chapters-CeKTBaiU.js';s=p.read_text('utf8');out=s
if 'validateStoryboardRows as RFValidateStoryboardRows' not in out:
 out='import{validateStoryboardRows as RFValidateStoryboardRows}from"./storyboard-complete.js";'+out
 start=out.index('async function bn(');end=out.index('async function xn(',start);block=out[start:end]
 assert block.count('operation:`storyboard`')==1
 block=block.replace('operation:`storyboard`','operation:`text`',1).replace('source:`short-drama-chapter-storyboard`','source:`short-drama-chapter-storyboard-preview`',1)
 out=out[:start]+block+out[end:]
 anchor='n.source===`short-drama-chapter-storyboard`?'
 assert out.count(anchor)==1
 out=out.replace(anchor,'(n.source===`short-drama-chapter-storyboard`||n.source===`short-drama-chapter-storyboard-preview`)?',1)
 anchor='on=async(t,n)=>{let r=RFPrepareRows(nn(n,e),e,t);'
 assert out.count(anchor)==1
 out=out.replace(anchor,'on=async(t,n)=>{let r=RFPrepareRows(nn(RFValidateStoryboardRows(n,RFReferenceCatalog(e),Ln(e.units.find(u=>u.id===t)?.sourceText||``)),e),e,t);',1)
 anchor='),l=o.rows.length;await RFRepair(e.project.id);await t(),$t(n.id,`storyboard`)'
 assert out.count(anchor)==1
 out=out.replace(anchor,'),l=await on(n.id,o.rows);await t(),$t(n.id,`storyboard`)',1)
 anchor='a===`storyboard`&&e.shots.some(t=>t.unitId===r)'
 assert out.count(anchor)==1
 out=out.replace(anchor,'a===`storyboard`&&Sn(n.inputJson).source!==`short-drama-chapter-storyboard-preview`&&e.shots.some(t=>t.unitId===r)',1)
 stage=root/'build'/'chapters-detail-v12.js';stage.write_text(out,encoding='utf8');subprocess.run(['node','--check',str(stage)],check=True);shutil.copy2(p,root/'backups'/('chapters-before-detail-v12-'+stamp+'.js'));p.write_text(out,encoding='utf8')
for name in ['storyboard-detail-contract.js','storyboard-detail-normalize.js','storyboard-complete.js','shot-asset-bindings.js']:
 target=assets/name
 if target.exists():shutil.copy2(target,root/'backups'/('before-detail-v12-'+stamp+'-'+name))
 subprocess.run(['node','--check',str(root/'src'/name)],check=True);shutil.copy2(root/'src'/name,target)
print('Installed v1.2: full main-script audit, lossless copy, preview first and commit only after validation.')
