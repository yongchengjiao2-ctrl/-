import pathlib,os,sqlite3,json,datetime,uuid,re,sys
root=pathlib.Path(__file__).resolve().parent
model,format_id=sys.argv[1:3];prefix=f'live-{model}-{format_id}'
report_path=root/'build'/f'{prefix}.report.json';report=json.loads(report_path.read_text(encoding='utf8'));assert report.get('validated'),report.get('error')
data=json.loads((root/'build'/f'{prefix}.assets.json').read_text(encoding='utf8'));input=json.loads((root/'build/live-test-input.json').read_text(encoding='utf8'));pid=input['projectId'];unit=input['chapterId']
c=sqlite3.connect(str(pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/data/open_ai_canvas.db'),timeout=20);c.row_factory=sqlite3.Row
backup=root/'backups'/f'before-{prefix}.db';backup=backup.with_name(backup.stem+'-'+uuid.uuid4().hex[:8]+'.db')
with sqlite3.connect(backup) as dest:c.backup(dest)
now=datetime.datetime.now().astimezone().isoformat(' ');saved=[]
with c:
 for key,category in [('characters','character'),('scenes','environment'),('props','prop')]:
  for asset in data[key]:
   asset['verification']={'model':model,'format':format_id,'providerRequestId':report.get('providerRequestId'),'validatedAt':report['finishedAt'],'requestStream':False}
   row=c.execute("select id,details_json from project_asset_candidates where project_id=? and unit_id=? and category=? and name_key=? and status='pending_confirmation' limit 1",(pid,unit,category,re.sub(r'[\s·•・《》〈〉「」『』【】\[\]（）()、，,:：。;；\-—_]','',asset['name'].casefold()))).fetchone()
   if row:
    candidate_id=row['id'];old=json.loads(row['details_json'] or '{}');history=old.get('verificationHistory',[])
    if old.get('verification'):history.append(old['verification'])
    asset['verificationHistory']=history
    c.execute('update project_asset_candidates set details_json=?,updated_at=? where id=?',(json.dumps(asset,ensure_ascii=False),now,candidate_id))
   else:
    candidate_id=uuid.uuid4().hex
    c.execute('insert into project_asset_candidates(id,project_id,unit_id,shot_id,name,name_key,category,status,source,details_json,resolved_asset_id,created_at,updated_at) values(?,?,?,?,?,?,?,?,?,?,?,?,?)',(candidate_id,pid,unit,'',asset['name'],re.sub(r'[\s·•・《》〈〉「」『』【】\[\]（）()、，,:：。;；\-—_]','',asset['name'].casefold()),category,'pending_confirmation','chapter_character_extract',json.dumps(asset,ensure_ascii=False),'',now,now))
   saved.append((candidate_id,category,asset['name']))
 for candidate_id,category,name in saved:
  r=c.execute('select status,details_json from project_asset_candidates where id=?',(candidate_id,)).fetchone();x=json.loads(r['details_json']);assert r['status']=='pending_confirmation';assert x['verification']['providerRequestId']==report.get('providerRequestId')
report.update(savedToProject=pid,savedToChapter=unit,savedCount=len(saved),readBackVerified=True,candidateIds=[x[0] for x in saved]);report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8');print('SAVED AND VERIFIED',model,format_id,len(saved),'candidates')
