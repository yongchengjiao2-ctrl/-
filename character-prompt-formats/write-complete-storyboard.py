"""Write the user-selected '测试' project, preserving previous revisions/artifacts."""
import sqlite3,pathlib,os,json,uuid,datetime,re
root=pathlib.Path(__file__).resolve().parent;folder=root/'build/storyboard-detail-v12';run='gemini-rich-2'
report=json.loads((folder/(run+'.report.json')).read_text('utf8'));assert report['validated'] and report['modelReturnedFullMain'] and report['narrationExact']
data=json.loads((folder/(run+'.complete.json')).read_text('utf8'));catalog=json.loads((folder/'catalog.json').read_text('utf8'));meta=json.loads((folder/'baseline.metadata.json').read_text('utf8'))['metadata'];pid=meta['domainProjectId'];unit=meta['chapterId'];rows=data['rows']
db=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/data/open_ai_canvas.db';c=sqlite3.connect(str(db),timeout=20);c.row_factory=sqlite3.Row
project=c.execute('select * from projects where id=?',(pid,)).fetchone();assert project['name']=='测试'
chapter=c.execute('select * from project_units where id=? and project_id=?',(unit,pid)).fetchone();assert chapter['source_text']==meta['expectedSourceText'],'Chapter changed since real request'
old=list(c.execute('select * from shots where project_id=? and unit_id=? order by position',(pid,unit)));assert len(old)<=len(rows),'Refuse to delete extra existing shots'
if (folder/'writeback.report.json').exists():raise RuntimeError('Already applied; refuse duplicate revision write')
expected=[(r['id'],r['current_revision_id']) for r in old];stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S');backup=root/'backups'/('before-complete-storyboard-'+stamp+'.db')
with sqlite3.connect(str(backup)) as destination:c.backup(destination)
now=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat(' ');applied=[];renamed=[]
try:
 c.execute('BEGIN IMMEDIATE')
 assert [(r['id'],r['current_revision_id']) for r in c.execute('select id,current_revision_id from shots where project_id=? and unit_id=? order by position',(pid,unit))]==expected,'Shots were edited concurrently'
 for a in catalog:
  if a.get('originalTitle'):
   actual=c.execute('select title from assets where id=?',(a['id'],)).fetchone()
   assert actual and actual['title'] in [a['originalTitle'],a['title']]
   c.execute('update assets set title=?,updated_at=? where id=?',(a['title'],now,a['id']));renamed.append({'id':a['id'],'before':actual['title'],'after':a['title']})
 for i,row in enumerate(rows):
  sid=old[i]['id'] if i<len(old) else uuid.uuid4().hex;revision=uuid.uuid4().hex;version=c.execute('select coalesce(max(version),0)+1 from shot_revisions where shot_id=?',(sid,)).fetchone()[0]
  duration=round(row['durationSeconds']*1000);assert 1000<=duration<=15000
  prompt=row['videoMotionPrompt'];assert '【一键复制AI视频纯享提示词' in prompt and '┌' in prompt
  if i>=len(old):c.execute('insert into shots(id,project_id,unit_id,current_revision_id,title,description,position,duration_ms,status,created_at,updated_at) values(?,?,?,?,?,?,?,?,?,?,?)',(sid,pid,unit,revision,f'镜头 {i+1:02d}',row['plotDescription'],i,duration,'draft',now,now))
  beats=[{'description':row['timeBeats']}] if row.get('timeBeats') else []
  c.execute('insert into shot_revisions(id,shot_id,version,plot_description,action,dialogue,shot_size,camera_angle,camera_movement,duration_ms,image_prompt,video_prompt,negative_prompt,continuity_notes,action_beats_json,created_by,created_at) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',(revision,sid,version,row['plotDescription'],row.get('performanceBlocking',''),row['dialogue'],row.get('shotSize',''),row.get('camera',''),row.get('motion',''),duration,row['imageGenerationPrompt'],prompt,row.get('negativePrompt',''),row.get('continuityOut',''),json.dumps(beats,ensure_ascii=False),project['user_id'],now))
  c.execute('update shots set current_revision_id=?,title=?,description=?,duration_ms=?,status=?,updated_at=? where id=?',(revision,f'镜头 {i+1:02d}',row['plotDescription'],duration,'draft',now,sid))
  versions=[]
  for b in row['assetBindings']:
   asset=c.execute('select a.primary_version_id from assets a join project_asset_links l on l.asset_id=a.id where a.id=? and l.project_id=?',(b['nodeId'],pid)).fetchone();assert asset and asset['primary_version_id'],'Invalid project binding';versions.append(asset['primary_version_id'])
  c.execute("update shot_asset_references set status='unlinked' where shot_id=? and status='linked'",(sid,))
  for vid in dict.fromkeys(versions):
   existing=c.execute('select id from shot_asset_references where shot_id=? and asset_version_id=?',(sid,vid)).fetchone()
   if existing:c.execute("update shot_asset_references set status='linked' where id=?",(existing['id'],))
   else:c.execute('insert into shot_asset_references(id,shot_id,asset_version_id,role,status,created_at) values(?,?,?,?,?,?)',(uuid.uuid4().hex,sid,vid,'reference','linked',now))
  applied.append({'shotId':sid,'revisionId':revision,'version':version,'references':len(set(versions))})
 c.execute('update projects set revision=revision+1,updated_at=? where id=?',(now,pid));c.execute('update project_units set updated_at=? where id=?',(now,unit));c.commit()
except:
 c.rollback();raise
stored=list(c.execute('select s.id,s.current_revision_id,r.video_prompt,r.dialogue from shots s join shot_revisions r on r.id=s.current_revision_id where s.project_id=? and s.unit_id=? order by s.position',(pid,unit)));assert len(stored)==len(rows)
for actual,row in zip(stored,rows):assert actual['video_prompt']==row['videoMotionPrompt'] and actual['dialogue']==row['dialogue']
out={'projectId':pid,'projectName':'测试','chapterId':unit,'run':run,'providerRequestId':report['providerRequestId'],'backup':str(backup),'oldShots':len(old),'newShots':len(rows),'previousRevisionsPreserved':True,'previousArtifactsPreserved':True,'readBackVerified':True,'renamedAssets':renamed,'applied':applied,'writtenAt':now}
(folder/'writeback.report.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8');print('Written and read-back verified:',len(rows),'segments. Old revisions and artifacts preserved. Backup:',backup.name)
