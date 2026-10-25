"""Apply reviewed binding plan with DB backup and immutable script revisions."""
import sqlite3,pathlib,os,json,uuid,datetime
root=pathlib.Path(__file__).resolve().parent
data=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/data'
db=data/'open_ai_canvas.db'
plan=json.loads((root/'build/binding-plan.json').read_text('utf-8'))
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
backup=data/'backups'/('before-shot-bindings-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'.db')
backup.parent.mkdir(exist_ok=True)
c=sqlite3.connect(db,timeout=15);c.row_factory=sqlite3.Row
with sqlite3.connect(backup) as destination:c.backup(destination)
try:
 c.execute('BEGIN IMMEDIATE')
 count=0
 for item in plan:
  shot=c.execute('select * from shots where id=?',(item['id'],)).fetchone()
  if not shot or shot['current_revision_id']!=item['revisionId']:raise RuntimeError('Shot changed since planning: '+item['title'])
  old=c.execute('select * from shot_revisions where id=?',(shot['current_revision_id'],)).fetchone()
  if old['video_prompt']!=item['revision']['videoPrompt']:raise RuntimeError('Prompt changed since planning')
  revision=dict(old);revision['id']=uuid.uuid4().hex
  revision['version']=c.execute('select coalesce(max(version),0)+1 from shot_revisions where shot_id=?',(shot['id'],)).fetchone()[0]
  revision['video_prompt']=item['videoPrompt'];revision['created_at']=now
  cols=list(revision);c.execute('insert into shot_revisions ('+','.join(cols)+') values ('+','.join('?' for _ in cols)+')',[revision[k] for k in cols])
  c.execute('update shots set current_revision_id=?,updated_at=? where id=?',(revision['id'],now,shot['id']))
  for asset in item['assets']:
   exists=c.execute("select 1 from shot_asset_references where shot_id=? and asset_version_id=? and status='linked'",(shot['id'],asset['primaryVersionId'])).fetchone()
   if not exists:
    c.execute('insert into shot_asset_references (id,shot_id,asset_version_id,role,status,created_at) values (?,?,?,?,?,?)',(uuid.uuid4().hex,shot['id'],asset['primaryVersionId'],'reference','linked',now));count+=1
 c.commit()
 print('Repaired',len(plan),'shots;',count,'asset links. Prior revisions retained. Backup:',backup)
 for row in c.execute("select s.title,count(r.id) n from shots s left join shot_asset_references r on r.shot_id=s.id and r.status='linked' group by s.id order by s.position"):print(row['title'],row['n'])
except:
 c.rollback();raise
finally:c.close()
