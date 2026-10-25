from _audit_install_guard import guard_legacy_install
guard_legacy_install(__file__, allow_build_only=False)
import pathlib,os,shutil,datetime,subprocess
root=pathlib.Path(__file__).resolve().parent
assets=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/versions/1.3.13/web/dist/assets'
p=assets/'chapters-CeKTBaiU.js';s=p.read_text(encoding='utf8')
backup=root/'backups'/('continuation-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'));backup.mkdir(parents=True);shutil.copy2(p,backup/p.name)
def once(old,new):
 global s
 assert s.count(old)==1,(old[:80],s.count(old));s=s.replace(old,new)
once('if(n.kind===`characters`&&e.status===`succeeded`){try{_n(e)}catch(t){return{...e,status:`failed`,error:`模型响应不完整或格式无效，资产未保存：${t.message}`}}}', 'if(n.kind===`characters`&&e.status===`succeeded`){e=await ot(e.id,{signal:t});try{_n(e)}catch(t){return{...e,status:`failed`,error:`资产结果校验失败：${t.message}`}}}')
once('try{mn(a.text)}catch(t){throw Error(`资产提取失败：响应不完整或不符合JSON合同，未保存资产。${t.message}`)}return a.text', '''return RFCompleteExtraction(a.text,{validate:mn,request:async(s,c)=>{let l=await B({projectId:e.projectId,nodeId:`chapter-assets-continuation:${e.chapterId}:${c}`,mode:`text`,prompt:RFBuild(n,e.roleFormat||RFSelected())+`\n\n【传输续接】上一次JSON被传输长度截断。下面是已收到的精确前缀。只输出紧接前缀最后一个字符之后的剩余内容，不重复前缀，不加解释或代码围栏。即使最后处于字符串内，也直接续写字符串内容，完成尚未输出的人物、场景、道具及全部闭合括号。不要重新输出顶层对象，不删减资产。\n【已收到的JSON前缀开始】\n`+s,config:{...e.config,model:i},metadata:{domainProjectId:e.projectId,source:`chapter-assets-continuation`,parentChapterId:e.chapterId,continuationIndex:c}});return l.text}})''')
s='import{completeExtraction as RFCompleteExtraction}from"./extraction-recovery.js";'+s
shutil.copy2(root/'src/extraction-recovery.js',assets/'extraction-recovery.js')
tmp=p.with_suffix('.tmp.js');tmp.write_text(s,encoding='utf8');subprocess.run(['node','--check',str(tmp)],check=True);tmp.replace(p)
(root/'build/chapters.with-recovery.js').write_text(s,encoding='utf8')
print('Installed hydration and continuation fix; backup:',backup)
