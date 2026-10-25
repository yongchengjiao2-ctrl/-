from _audit_install_guard import guard_legacy_install
guard_legacy_install(__file__, allow_build_only=False)
import pathlib,os,datetime,shutil,subprocess
root=pathlib.Path(__file__).resolve().parent;assets=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/versions/1.3.13/web/dist/assets';p=assets/'chapters-CeKTBaiU.js';s=p.read_text('utf8');out=s
if 'oneChapterSubmission as RFOneSubmission' not in out:
 out='import{oneChapterSubmission as RFOneSubmission,makeSingleModelTask as RFSingleTask}from"./storyboard-single-call.js";'+out
 a=out.index('async function bn(');b=out.index('async function xn(',a);block=out[a:b];assert block.count('o=await lt({')==1;block=block.replace('o=await lt({','o=await RFSingleTask(lt)({',1);out=out[:a]+block+out[b:]
 a=out.index('cn=async()=>{');b=out.index(',ln=e=>new Promise(',a);block=out[a:b];assert block.endswith('}}}')
 block=block.replace('cn=async()=>{','cn=()=>RFOneSubmission(`${e.project.id}:${V?.id||``}`,async()=>{',1)+')';out=out[:a]+block+out[b:]
 stage=root/'build/chapters-single-call.js';stage.write_text(out,encoding='utf8');result=subprocess.run(['node','--check',str(stage)],capture_output=True,text=True,encoding='utf8');assert result.returncode==0,'Patched chapter syntax rejected; installed module unchanged'
 shutil.copy2(p,root/'backups'/('before-single-call-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'.js'));p.write_text(out,encoding='utf8')
for name in ['storyboard-single-call.js','storyboard-spatial-render.js','storyboard-detail-normalize.js']:shutil.copy2(root/'src'/name,assets/name)
print('Installed single-submit guard and local spatial rendering; no extra model calls.')
