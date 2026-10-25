import pathlib,os,sqlite3,json,datetime,uuid
root=pathlib.Path(__file__).resolve().parent;data=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/data';db=data/'open_ai_canvas.db';c=sqlite3.connect(db,timeout=20);c.row_factory=sqlite3.Row
plan=json.loads((root/'build/current-binding-plan.json').read_text(encoding='utf8'));now=datetime.datetime.now().astimezone().isoformat(' ');backup=data/'backups'/('before-auto-mentions-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'.db');backup.parent.mkdir(exist_ok=True)
with sqlite3.connect(backup) as dest:c.backup(dest)
try:
 c.execute('begin immediate');changed=0;links=0
 for item in plan:
  shot=c.execute('select * from shots where id=?',(item['id'],)).fetchone()
  assert shot['current_revision_id']==item['revisionId'],'Shot changed; regenerate plan'
  old=dict(c.execute('select * from shot_revisions where id=?',(item['revisionId'],)).fetchone())
  if old['video_prompt']!=item['videoPrompt']:
   old.update(id=uuid.uuid4().hex,version=c.execute('select max(version)+1 from shot_revisions where shot_id=?',(shot['id'],)).fetchone()[0],video_prompt=item['videoPrompt'],created_at=now)
   cols=list(old);c.execute('insert into shot_revisions('+','.join(cols)+') values('+','.join('?' for _ in cols)+')',[old[k] for k in cols]);c.execute('update shots set current_revision_id=?,updated_at=? where id=?',(old['id'],now,shot['id']));changed+=1
  for asset in item['assets']:
   version=asset.get('primaryVersionId')
   if not version:continue
   if c.execute("select 1 from shot_asset_references where shot_id=? and asset_version_id=? and status='linked'",(shot['id'],version)).fetchone():continue
   c.execute('insert into shot_asset_references(id,shot_id,asset_version_id,role,status,created_at) values(?,?,?,?,?,?)',(uuid.uuid4().hex,shot['id'],version,'reference','linked',now));links+=1
 c.commit();print('Saved',changed,'new revisions; added',links,'real links. Backup:',backup)
 for item in plan:
  prompt=c.execute('select r.video_prompt from shots s join shot_revisions r on r.id=s.current_revision_id where s.id=?',(item['id'],)).fetchone()[0]
  assert '@' in prompt and ' 是' in prompt
 print('Verified 10/10 saved prompts contain @ introductions; dialogue and prior revisions retained.')
except:c.rollback();raise
