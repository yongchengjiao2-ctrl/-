import sqlite3,pathlib,os,json,uuid,datetime
root=pathlib.Path(__file__).resolve().parent;folder=root/'build/test-six';snapshot=json.loads((folder/'input.json').read_text('utf8'));pid=snapshot['project']['id'];assert snapshot['project']['name']=='测试六'
reports=[json.loads((folder/f'chapter-{i}-v3.report.json').read_text('utf8')) for i in [1,2,3]]
assert all(r['validated'] and r['narrationExact'] for r in reports)
data=[json.loads((folder/f'chapter-{i}-v3.complete.json').read_text('utf8')) for i in [1,2,3]]
db=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/data/open_ai_canvas.db';c=sqlite3.connect(str(db),timeout=30);c.row_factory=sqlite3.Row
if (folder/'writeback.json').exists():raise RuntimeError('Already written; refuse duplicate writes')
for unit in snapshot['units']:
 actual=c.execute('select source_text from project_units where id=? and project_id=?',(unit['id'],pid)).fetchone();assert actual and actual['source_text']==unit['source_text'],'Chapter edited after test; refuse stale result'
stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S');backup=root/'backups'/('before-test-six-planned-'+stamp+'.db')
with sqlite3.connect(str(backup)) as dest:c.backup(dest)
now=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat(' ');written=[]
with c:
 c.execute('BEGIN IMMEDIATE')
 for unit,result,report in zip(snapshot['units'],data,reports):
  old=list(c.execute('select * from shots where project_id=? and unit_id=? order by position',(pid,unit['id'])));assert len(old)<=len(result['rows']),'Refuse to delete existing excess shots'
  entries=[]
  for i,row in enumerate(result['rows']):
   sid=old[i]['id'] if i<len(old) else uuid.uuid4().hex;rid=uuid.uuid4().hex;duration=round(row['durationSeconds']*1000);assert 1000<=duration<=15000
   version=c.execute('select coalesce(max(version),0)+1 from shot_revisions where shot_id=?',(sid,)).fetchone()[0]
   if i>=len(old):c.execute('insert into shots(id,project_id,unit_id,current_revision_id,title,description,position,duration_ms,status,created_at,updated_at) values(?,?,?,?,?,?,?,?,?,?,?)',(sid,pid,unit['id'],rid,f'镜头 {i+1:02d}',row['plotDescription'],i,duration,'draft',now,now))
   c.execute('insert into shot_revisions(id,shot_id,version,plot_description,action,dialogue,shot_size,camera_angle,camera_movement,duration_ms,image_prompt,video_prompt,negative_prompt,continuity_notes,action_beats_json,created_by,created_at) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',(rid,sid,version,row['plotDescription'],row['performanceBlocking'],row['dialogue'],'',row['camera'],row['motion'],duration,row['imageGenerationPrompt'],row['videoMotionPrompt'],row['negativePrompt'],row['continuityOut'],json.dumps([{'description':row['timeBeats']}],ensure_ascii=False),snapshot['project']['user_id'],now))
   c.execute('update shots set current_revision_id=?,title=?,description=?,duration_ms=?,updated_at=? where id=?',(rid,f'镜头 {i+1:02d}',row['plotDescription'],duration,now,sid));entries.append({'shotId':sid,'revisionId':rid,'version':version})
  c.execute('update project_units set updated_at=? where id=?',(now,unit['id']));written.append({'chapter':unit['title'],'chapterId':unit['id'],'shots':len(entries),'providerRequestId':report['providerRequestId'],'entries':entries})
 c.execute('update projects set revision=revision+1,updated_at=? where id=?',(now,pid))
for unit,result in zip(snapshot['units'],data):
 actual=list(c.execute('select r.video_prompt,r.dialogue,s.duration_ms from shots s join shot_revisions r on r.id=s.current_revision_id where s.project_id=? and s.unit_id=? order by s.position',(pid,unit['id'])));assert len(actual)==len(result['rows'])
 for saved,row in zip(actual,result['rows']):assert saved['video_prompt']==row['videoMotionPrompt'] and saved['dialogue']==row['dialogue'] and saved['duration_ms']==row['durationSeconds']*1000
out={'projectId':pid,'projectName':'测试六','backup':str(backup),'writtenAt':now,'readBackVerified':True,'previousRevisionsPreserved':True,'chapters':written};(folder/'writeback.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8');print('Written and read-back verified all 3 chapters:',[x['shots'] for x in written])
