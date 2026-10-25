import pathlib,os,subprocess,json,concurrent.futures
out=pathlib.Path(__file__).parent;a=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/versions/1.3.13/web/dist/assets'
inventory=json.loads((out/'inventory.json').read_text('utf8'))
names={r['name'] for r in inventory['source_drift']}|{n for t in ['settings','skill','chapter','workflow','project'] for n in inventory['modules'].get(t,[]) if n.endswith('.js')}
names|={'assets-BpSjmEjz.js','skill-runtime-CF8drDK4.js','project-B6TxOaS-.js','canvas-project-generation-DKqeyZxD.js','generation-task-B2p8YPAC.js'}
def check(n):
 p=subprocess.run(['node','--check',str(a/n)],capture_output=True,text=True,encoding='utf8');return {'file':n,'ok':p.returncode==0,'error':p.stderr[:600]}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:r=list(pool.map(check,sorted(names)))
(out/'syntax-results.json').write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf8');print('syntax',len(r),'passed',sum(x['ok'] for x in r));print([x for x in r if not x['ok']])
