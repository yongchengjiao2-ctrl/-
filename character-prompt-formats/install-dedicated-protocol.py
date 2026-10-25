from _audit_install_guard import guard_legacy_install
guard_legacy_install(__file__, allow_build_only=False)
import pathlib,os,json,zipfile,hashlib,datetime,shutil
root=pathlib.Path(__file__).resolve().parent;data=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/data';rp=data/'plugin_registry.json';registry=json.loads(rp.read_text(encoding='utf-8-sig'));base=next(x for x in registry if x['id']=='a6api');manifest=json.loads(json.dumps(base['manifest']));provider=json.loads(json.dumps(manifest['contributes']['providers'][0]));pid='yingce-asset-json-chat';pluginid='yingce-asset-json'
provider=json.loads(json.dumps(provider).replace('a6api-chat',pid));provider['id']=pid;provider['label']='资产提取专用 JSON（非流式）';provider['create']['body']['stream']=False;provider['create']['body']['response_format']={'type':'json_object'};provider['create']['body']['thinking']={'$omitEmpty':{'$ref':f'request.providerOptions.{pid}.thinking'}};provider['create']['body']['max_tokens']={'$coalesce':[{'$ref':f'request.providerOptions.{pid}.max_tokens'},65536]}
provider['parameters'].append({'name':'thinking','type':'object','required':False,'mapping':'thinking','description':'DeepSeek原生思考开关；资产提取使用disabled。'})
manifest.update(id=pluginid,name='影策资产 JSON 专用协议',version='1.0.0',author='Local workspace',description='仅资产提取使用：固定非流式及JSON模式，支持DeepSeek思考开关。',documentation='独立本地协议，避免官方A6api包同步覆盖。保留原有认证配置，不包含密钥。')
manifest['contributes']={'providers':[provider]};build=root/'build';build.mkdir(exist_ok=True);package=build/'yingce-asset-json.yingce-plugin'
with zipfile.ZipFile(package,'w',zipfile.ZIP_DEFLATED) as z:z.writestr('manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2));z.writestr('README.md','Asset extraction JSON protocol. Uses the existing configured API credential. Contains no credential.\n')
digest=hashlib.sha256(package.read_bytes()).hexdigest();name=digest+'.yingce-plugin';shutil.copy2(package,data/'plugin-packages'/name)
backup=root/'backups'/('registry-before-dedicated-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'.json');shutil.copy2(rp,backup)
now=datetime.datetime.now(datetime.timezone.utc).isoformat();entry={'id':pluginid,'source':'local','fileName':package.name,'packagePath':name,'packageSha256':digest,'installedAt':now,'updatedAt':now,'manifest':manifest};registry=[x for x in registry if x['id']!=pluginid]+[entry];rp.write_text(json.dumps(registry,ensure_ascii=False,indent=2),encoding='utf8')
assert hashlib.sha256((data/'plugin-packages'/name).read_bytes()).hexdigest()==digest
p=root/'src/asset-extraction-runtime-v3.js';s=p.read_text(encoding='utf8');old='const config=normalizeTextConfig({...e.config,model,textModel:model},model);';new='''const normalized=normalizeTextConfig({...e.config,model,textModel:model},model);
 const channelId=model.includes('::')?model.split('::')[0]:null;
 const plainModel=model.split('::').at(-1);
 const protocol='yingce-asset-json-chat';
 const config={...normalized,channels:normalized.channels.map(c=>(channelId?c.id===channelId:c.models?.includes(plainModel))?{...c,interfaceType:protocol,modelCosts:[...(c.modelCosts||[]).filter(x=>x.model!==plainModel),{...(c.modelCosts||[]).find(x=>x.model===plainModel),model:plainModel,protocol,defaultOptions:{...model.includes('deepseek')?{thinking:{type:'disabled'}}:{},max_tokens:65536,stream:false,response_format:{type:'json_object'}}}]}:c)};'''
assert old in s;s=s.replace(old,new).replace("providerOptions:{'a6api-chat':",'providerOptions:{[protocol]:');p.write_text(s,encoding='utf8');shutil.copy2(p,pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/versions/1.3.13/web/dist/assets'/p.name)
print('Built and registered dedicated local protocol:',pluginid,'SHA256 verified. Original official plugin unchanged.')
