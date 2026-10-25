from _audit_install_guard import guard_legacy_install
guard_legacy_install(__file__, allow_build_only=False)
import pathlib,os,datetime,shutil,subprocess
root=pathlib.Path('character-prompt-formats').resolve();assets=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/versions/1.3.13/web/dist/assets';backup=root/'backups'/('response-mode-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'));backup.mkdir(parents=True)
p=assets/'chapters-CeKTBaiU.js';s=p.read_text(encoding='utf8');shutil.copy2(p,backup/p.name)
a='async function xn(e,t,n,r){let i=e.config.textModel||e.config.model,a=await B({'
b='async function xn(e,t,n,r){let RFStream=RFExtractionStream(),i=e.config.textModel||e.config.model,a=await B({streamText:RFStream,'
assert s.count(a)==1;s=s.replace(a,b)
a='let l=await B({projectId:e.projectId,nodeId:`chapter-assets-continuation:'
b='let l=await B({streamText:RFStream,projectId:e.projectId,nodeId:`chapter-assets-continuation:'
assert s.count(a)==1;s=s.replace(a,b)
s='import{extractionStream as RFExtractionStream}from"./extraction-response-mode.js";'+s
f=root/'src/character-prompt-formats.js';original=f.read_text(encoding='utf8');shutil.copy2(f,backup/f.name)
a="return h('section',{'aria-label':'资产提取模板',style:{display:'grid',gap:8}},"
assert original.count(a)==1
updated="import{ResponseModePicker}from './extraction-response-mode.js';\n"+original.replace(a,a+"\n    h(ResponseModePicker,{react:React}),")
f.write_text(updated,encoding='utf8')
for target,content in [(p,s),(assets/'character-prompt-formats.js',updated)]:
 tmp=target.with_suffix('.tmp.js');tmp.write_text(content,encoding='utf8');subprocess.run(['node','--check',str(tmp)],check=True);tmp.replace(target)
shutil.copy2(root/'src/extraction-response-mode.js',assets/'extraction-response-mode.js')
(root/'build/chapters.with-response-mode.js').write_text(s,encoding='utf8');print('Installed response mode picker; default non-stream; continuation uses same snapshot.')
