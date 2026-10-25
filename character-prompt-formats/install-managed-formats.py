from _audit_install_guard import guard_legacy_install
guard_legacy_install(__file__, allow_build_only=False)
import os,json,sqlite3,pathlib,datetime,shutil,subprocess
root=pathlib.Path(__file__).resolve().parent
home=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas'
assets=home/'versions/1.3.13/web/dist/assets'
stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
backup=root/'backups'/('managed-templates-'+stamp);backup.mkdir(parents=True)
db=home/'data/open_ai_canvas.db'
with sqlite3.connect(db) as c,sqlite3.connect(backup/'database.db') as dest:c.backup(dest)
formats=json.loads((root/'build/managed-formats.json').read_text('utf8'))
ops=['chapter_assets_extract','character_extract','character_turnaround']
# Replace the two obsolete slots explicitly identified by the user; preserve IDs and other templates.
with sqlite3.connect(db) as c:
 for op,f in zip(ops,formats):
  row=c.execute('select id from prompt_templates where operation=? and enabled=1',(op,)).fetchall()
  assert len(row)==1,(op,row)
  c.execute("update prompt_templates set name=?,content=?,output_type='json',updated_at=datetime('now') where id=?",(f['name'],f['content'],row[0][0]))
source=root/'src/character-prompt-formats.js'
for target in [assets/source.name,assets/'chapters-CeKTBaiU.js']:
 shutil.copy2(target,backup/target.name)
shutil.copy2(source,assets/source.name)
chapter=assets/'chapters-CeKTBaiU.js';text=chapter.read_text('utf8')
assert text.count('roleFormat:RFSelected()')+text.count('roleFormat:await RFSelected()')==1
text=text.replace('roleFormat:RFSelected()','roleFormat:await RFSelected()').replace('Xt=t=>{let n=V;','Xt=async t=>{let n=V;').replace('let e=Xt(L);','let e=await Xt(L);')
subprocess.run(['node','--check','--input-type=module'],input=text,text=True,encoding='utf-8',check=True)
chapter.write_text(text,'utf8')
# Keep admin labels, insertion variables and JSON contract consistent with the complete extraction templates.
labels=dict(zip(ops,[f['name'] for f in formats]))
for target in assets.glob('storyboard-prompts-page-*.js'):
 text=target.read_text('utf8')
 import re
 match=re.search(r'([A-Za-z_$][\w$]*)\(e.templates\),([A-Za-z_$][\w$]*)\(e.definitions\)',text)
 if not match:continue
 old=match.group(0)
 new=match.group(1)+'(e.templates),'+match.group(2)+"(e.definitions.map(d=>{const names="+json.dumps(labels,ensure_ascii=False)+";const base=e.definitions.find(x=>x.operation==='chapter_assets_extract');return names[d.operation]?{...base,operation:d.operation,label:names[d.operation],category:'角色',outputType:'json'}:d}))"
 shutil.copy2(target,backup/target.name)
 text=text.replace(old,new,1)
 subprocess.run(['node','--check','--input-type=module'],input=text,text=True,encoding='utf-8',check=True,capture_output=True)
 target.write_text(text,'utf8')
print('Installed managed templates; backup: '+str(backup))

