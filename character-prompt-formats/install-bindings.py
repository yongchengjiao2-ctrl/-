from _audit_install_guard import guard_legacy_install
guard_legacy_install(__file__, allow_build_only=False)
import os,pathlib,shutil,subprocess
root=pathlib.Path(__file__).resolve().parent
assets=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/versions/1.3.13/web/dist/assets'
def edit(name,transform):
 p=assets/name;s=p.read_text('utf-8');backup=root/'backups'/('bindings-'+name)
 if 'shot-asset-bindings.js' in s:return
 out=transform(s)
 stage=root/'build'/name;stage.write_text(out,encoding='utf-8');subprocess.run(['node','--check',str(stage)],check=True)
 if p.read_text('utf-8')!=s:raise RuntimeError('Concurrent edit, retry')
 if not backup.exists():shutil.copy2(p,backup)
 stage_tmp=p.with_suffix('.js.tmp');shutil.copy2(stage,stage_tmp);stage_tmp.replace(p)
def once(s,a,b):
 if s.count(a)!=1:raise RuntimeError('Unexpected anchor: '+a[:70])
 return s.replace(a,b,1)
def chapter(s):
 start=s.index('function tn(e){');end=s.index('function nn(e,t)',start)
 s=s[:start]+'''function tn(e){return e.assets.filter(a=>a.primaryVersionId&&[`character`,`environment`,`prop`].includes(a.category)).map(a=>({id:a.id,title:a.title,type:a.category===`character`?`character`:`image`,category:a.category,tags:[],prompt:cn(a.previewText,a.character?.definition,a.title),assetVersionId:a.primaryVersionId,...a.category===`character`?{characterAssetId:a.id,characterVersionId:a.character?.versionId||a.primaryVersionId}:{}}))}'''+s[end:]
 s=once(s,'l=o.rows.length;await t(),','l=o.rows.length;await RFRepair(e.project.id);await t(),')
 s=once(s,'素材绑定使用实际ID，最多9项，不编造名称或ID。','素材绑定必须逐镜填写assetBindings（nodeId使用下方目录实际id），以及人物characters中的characterAssetId。角色、场景、道具三类均须绑定；没有图片但有设定的资产也能绑定。只关联本镜实际可见资产，旁白提及不算出场。所有可见人物与道具用目录真实名称，不输出“真实人物素材”等占位词。最多9项，不编造名称或ID。')
 return 'import{repairStoredProject as RFRepair}from"./shot-asset-bindings.js";'+s
def references(s):
 s=once(s,'return{mentionReferences:a.map(', 'return RFAugment({mentionReferences:a.map(')
 s=once(s,':[])}}function C',':[])},e,t)}function C')
 s=once(s,'new Map(t.mentionReferences.map((e,t)=>[e.assetId,`图片${t+1}`]))','new Map(t.mentionReferences.map(e=>{let r=t.assetReferences.find(r=>r.assetId===e.assetId);return[e.assetId,r?.imageIndex?`图片${r.imageIndex}`:e.title]}))')
 s=once(s,'${e.category===`character`?`人物参考`:`${j(e.category)}参考`}：图片${e.imageIndex}', '${e.category===`character`?`人物参考`:`${j(e.category)}参考`}：${e.imageIndex?`图片${e.imageIndex}`:`${e.title}（设定参考，尚无参考图）`}')
 return 'import{augmentReferences as RFAugment}from"./shot-asset-bindings.js";'+s
shutil.copy2(root/'src/storyboard-template-standard.js',assets/'storyboard-template-standard.js')
shutil.copy2(root/'src/shot-asset-bindings.js',assets/'shot-asset-bindings.js')
edit('chapters-CeKTBaiU.js',chapter)
edit('workflow-shot-references-CRoK17V2.js',references)
print('Installed asset catalog, post-generation bindings and text-reference support.')
