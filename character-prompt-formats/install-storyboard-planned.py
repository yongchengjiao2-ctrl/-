from _audit_install_guard import guard_legacy_install
guard_legacy_install(__file__, allow_build_only=False)
import pathlib,os,datetime,shutil,subprocess,json,hashlib,zipfile
root=pathlib.Path(__file__).resolve().parent;home=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas';assets=home/'versions/1.3.13/web/dist/assets';stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
p=assets/'chapters-CeKTBaiU.js';s=p.read_text('utf8');out=s
if 'generatePlannedChapter as RFPlannedChapter' not in out:
 a=out.index('async function bn(');b=out.index('async function xn(',a)
 (root/'backups'/('bn-before-planned-'+stamp+'.txt')).write_text(out[a:b],encoding='utf8')
 replacement='async function bn(e,t){return RFPlannedChapter(e,t,{prepare:x=>Tt.prepare(x),createTask:lt,queryTask:ot,textConfig:it})}'
 out=out[:a]+replacement+out[b:]
 out='import{generatePlannedChapter as RFPlannedChapter,recoverPlannedTask as RFRecoverPlanned}from"./storyboard-planned-runtime.js";'+out
 assert out.count('function vn(e){return Je(e)}')==1
 out=out.replace('function vn(e){return Je(e)}','function vn(e){return Sn(e.inputJson).storyboardPlanVersion?RFRecoverPlanned(e):Je(e)}',1)
 stage=root/'build/chapters-planned.js';stage.write_text(out,encoding='utf8');check=subprocess.run(['node','--check',str(stage)],capture_output=True);assert check.returncode==0,'Invalid chapter patch; installation unchanged'
 shutil.copy2(p,root/'backups'/('chapters-before-planned-'+stamp+'.js'));p.write_text(out,encoding='utf8')
for name in ['storyboard-planned.js','storyboard-planned-runtime.js','storyboard-detail-contract.js','storyboard-detail-normalize.js','shot-asset-bindings.js']:
 target=assets/name
 if target.exists():shutil.copy2(target,root/'backups'/('before-planned-'+stamp+'-'+name))
 shutil.copy2(root/'src'/name,target)
# Existing protocol accepts the per-request structured response format; asset
# extraction defaults remain JSON object. No secrets or global channels change.
rp=home/'data/plugin_registry.json';registry=json.loads(rp.read_text('utf-8-sig'));entry=next(e for e in registry if e['id']=='yingce-asset-json');provider=entry['manifest']['contributes']['providers'][0];pid=provider['id']
new_format={'$coalesce':[{'$ref':f'request.providerOptions.{pid}.response_format'},{'type':'json_object'}]}
if provider['create']['body']['response_format']!=new_format:
 shutil.copy2(rp,root/'backups'/('registry-before-planned-'+stamp+'.json'));provider['create']['body']['response_format']=new_format
 package=root/'build/yingce-asset-json-planned.yingce-plugin'
 with zipfile.ZipFile(package,'w',zipfile.ZIP_DEFLATED) as z:z.writestr('manifest.json',json.dumps(entry['manifest'],ensure_ascii=False,indent=2));z.writestr('README.md','Local JSON protocol. Response format may be specified per request. No credentials.\n')
 digest=hashlib.sha256(package.read_bytes()).hexdigest();name=digest+'.yingce-plugin';shutil.copy2(package,home/'data/plugin-packages'/name);entry['packagePath']=name;entry['packageSha256']=digest;entry['updatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();rp.write_text(json.dumps(registry,ensure_ascii=False,indent=2),encoding='utf8')
print('Installed locked speech/time plan and structured director prompt. Single model call; no auto repair.')
