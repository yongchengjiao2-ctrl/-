import pathlib,json,hashlib,datetime
report=pathlib.Path(__file__).parent
root=report.parent
result=json.loads((report/'user-install-result.json').read_text(encoding='utf8'))
batch=json.loads(pathlib.Path(result['manifest']).read_text(encoding='utf8'))
runtime=next(x for x in batch['files'] if x['name']=='storyboard-planned-runtime.js')
source=root/'character-prompt-formats/src/storyboard-planned-runtime.js'
assert hashlib.sha256(source.read_bytes()).hexdigest()==runtime['beforeSha256'], 'Concurrent source update preserved'
source.write_bytes(pathlib.Path(runtime['source']).read_bytes())
p=report/'installed-repair-manifest.json'
summary=json.loads(p.read_text(encoding='utf8'))
summary.setdefault('manifests',[]).append(result['manifest'])
rows={x['name']:x for x in summary['files']}
for x in batch['files']:
 rows[x['name']]={'name':x['name'],'path':x['target'],'sha256':x['afterSha256'],'reviewedSha256':x['afterSha256'],'matchesReviewed':True,'reviewScope':'user-requested installation; offline regression and installed smoke passed, no desktop E2E claim'}
summary.update(files=list(rows.values()),lastUserRequestedInstallAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),lastInstallManifest=result['manifest'],preservedMode='autonomous-director-v4',wholeProductAccepted=False)
p.write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
p=report/'修复总控与验收状态.md'
with p.open('a',encoding='utf8') as f:
 f.write('\n## 用户要求安装后的部署记录\n\n2026-10-25 已部署7个模块（4个替换、3个新增）。保留现有自主导演v4模式，合入章节重试任务隔离、来源sidecar最终解析、重复JSON键拒绝及其依赖。固定规划合同5候选没有切为默认；提取v6/v7运行时没有部署。\n\n安装前207/207回归通过；安装后7个文件哈希全部一致，依赖无缺失、语法通过；实际安装运行时自主生成/恢复与A-B重试隔离离线冒烟通过。无新供应商请求，无业务数据库改写。详情user-install-result.json、user-install-verified.json、user-install-smoke-result.json。现有窗口可能缓存旧模块，保存工作后重启影策加载。完整界面和内容验收仍未完成。\n\n备份目录：'+batch['backupDir']+'\n')
print('Source synchronized and deployment records updated')
