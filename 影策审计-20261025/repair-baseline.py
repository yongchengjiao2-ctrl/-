import pathlib,os,datetime,json,hashlib,sqlite3,shutil
root=pathlib.Path(__file__).parent;ws=root.parent
base=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas';assets=base/'versions/1.3.13/web/dist/assets'
stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S');out=root/'repair-backups'/stamp;out.mkdir(parents=True)
files=list((ws/'character-prompt-formats/src').glob('*.js'))
files += [assets/n for n in ['chapters-CeKTBaiU.js','assets-BpSjmEjz.js','settings-D8GTFmm6.js','skill-runtime-CF8drDK4.js','user-data-sync-B6hrlYAn.js']]
files += [assets/p.name for p in (ws/'character-prompt-formats/src').glob('*.js') if (assets/p.name).exists()]
manifest=[]
for p in dict.fromkeys(files):
 if not p.exists():continue
 group='installed' if p.parent==assets else 'source';target=out/group/p.name;target.parent.mkdir(exist_ok=True);shutil.copy2(p,target)
 manifest.append({'path':str(p),'backup':str(target),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
db=base/'data/open_ai_canvas.db'
with sqlite3.connect(db.as_uri()+'?mode=ro',uri=True) as source,sqlite3.connect(out/'open_ai_canvas.db') as target:source.backup(target)
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
(root/'repair-baseline-path.txt').write_text(str(out),encoding='utf8');print('Baseline files',len(manifest),'saved',out)
