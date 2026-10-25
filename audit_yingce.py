import os,pathlib,re,json,sqlite3,hashlib,collections
ROOT=pathlib.Path(__file__).parent
OUT=ROOT/'影策审计-20261025';OUT.mkdir(exist_ok=True)
BASE=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas'
DIST=BASE/'versions/1.3.13/web/dist';AS=DIST/'assets'
c=sqlite3.connect((BASE/'data/open_ai_canvas.db').as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
def rows(q):return [dict(r) for r in c.execute(q)]
tables=rows("select name,sql from sqlite_master where type='table'")
summary={'counts':{r['name']:c.execute('select count(*) from "'+r['name']+'"').fetchone()[0] for r in tables},'schemas':{r['name']:r['sql'] for r in tables if any(x in r['name'] for x in ['task','skill','setting','prompt','canvas','agent','plugin'])}}
for key,q in {'templates':'select id,operation,name,version,enabled,output_type,length(content) length from prompt_templates','customizations':'select operation,mode,base_template_id,length(content) length from user_prompt_customizations','task_status':'select operation,status,stage,count(*) count from tasks group by operation,status,stage','candidates':'select category,status,count(*) count from project_asset_candidates group by category,status','plugins':'select id,name,enabled from sqlite_master where 0'}.items():
 try:summary[key]=rows(q)
 except Exception as e:summary[key]={'error':str(e)}
html=(DIST/'index.html').read_text('utf8'); roots=re.findall(r'(?:src|href)="(/assets/[^"?]+)',html)
seen=set();missing=[];queue=[x.removeprefix('/assets/') for x in roots]
while queue:
 name=queue.pop()
 if name in seen:continue
 seen.add(name);p=AS/name
 if not p.exists():missing.append(name);continue
 if p.suffix!='.js':continue
 s=p.read_text('utf8');refs=re.findall(r'["\x27](?:\./)?([\w@./-]+\.(?:js|css))["\x27]',s)
 refs=[x for x in refs if (AS/x.removeprefix('assets/')).is_file() or x.startswith('assets/') or re.search(r'(?:from\s*|import\s*\()["\x27]\\?\./'+re.escape(x),s)]
 queue.extend(x.removeprefix('assets/') for x in refs if not x.startswith('/') and not x.startswith('http') and x.removeprefix('assets/') not in seen)
summary['module_graph']={'reachable':len(seen),'missing':missing,'total_js':len(list(AS.glob('*.js')))}
(OUT/'reachable-files.txt').write_text('\n'.join(sorted(seen)),encoding='utf8')
topics=['canvas','settings','skill','agent','prompt','workflow','chapter','project','matching','copy','extract']
summary['modules']={t:[n for n in sorted(seen) if t in n] for t in topics}
for n in seen:
 if any(t in n for t in ['workspace-route-modules','settings-route','chapters-','character-prompt-formats','asset-extraction-runtime','extraction-completeness','shot-asset-bindings','storyboard-single-call']):
  p=AS/n
  if p.is_file():
   target=OUT/'code'/n;target.parent.mkdir(exist_ok=True,parents=True);target.write_text(p.read_text('utf8').replace(';',';\n'),encoding='utf8')
summary['source_drift']=[]
for p in (ROOT/'character-prompt-formats/src').glob('*.js'):
 installed=AS/p.name
 if installed.exists():summary['source_drift'].append({'name':p.name,'same':p.read_bytes()==installed.read_bytes(),'src_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'installed_sha256':hashlib.sha256(installed.read_bytes()).hexdigest()})
registry=json.loads((BASE/'data/plugin_registry.json').read_text('utf-8-sig'))
summary['plugin_registry']=[{'id':p.get('id'),'name':p.get('manifest',{}).get('name'),'providers':[{'id':x.get('id'),'capabilities':x.get('capabilities')} for x in p.get('manifest',{}).get('contributes',{}).get('providers',[])],'package_exists':(BASE/'data/plugin-packages'/p.get('packagePath','MISSING')).is_file(),'sha256_ok':hashlib.sha256((BASE/'data/plugin-packages'/p['packagePath']).read_bytes()).hexdigest()==p.get('packageSha256') if (BASE/'data/plugin-packages'/p.get('packagePath','MISSING')).is_file() else False} for p in registry]
(OUT/'inventory.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in summary.items() if k not in ['schemas','modules','counts','templates','task_status']},ensure_ascii=False,indent=2))
print('counts',json.dumps({k:v for k,v in summary['counts'].items() if any(x in k for x in ['skill','canvas','task','agent','prompt','setting'])}))
print('modules',json.dumps(summary['modules'],ensure_ascii=False))
