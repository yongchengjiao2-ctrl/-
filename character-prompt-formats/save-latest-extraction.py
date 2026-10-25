import pathlib,os,sqlite3,json,datetime,uuid,re
root=pathlib.Path(__file__).resolve().parent;db=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/data/open_ai_canvas.db';c=sqlite3.connect(db);c.row_factory=sqlite3.Row
row=c.execute("select * from tasks where id='7e80f260bcc2a3dfc06da7a45129380d'").fetchone();assert row['status']=='succeeded';m=json.loads(row['input_json'])['metadata'];v=json.loads(json.loads(row['result_json'])['text']);pid=m['domainProjectId'];unit=m['chapterId'];now=datetime.datetime.now().astimezone().isoformat(' ')
bp=root/'backups/latest-extraction-before-save.db';assert not bp.exists();b=sqlite3.connect(bp);c.backup(b);b.close()
rename={'天津学生代表群体':'天津学生代表','北洋军警群体':'北洋军警','声援北京还我主权旗帜':'请愿抗议旗帜','长枪与刺刀':'北洋军警步枪及刺刀','天津地方法院判决书':'民国《天津地方法院判决书》'}
written=0
with c:
 for key,cat in [('characters','character'),('scenes','environment'),('props','prop')]:
  for raw in v[key]:
   a=dict(raw)
   if cat!='character':assert all(isinstance(a.get(k),str) and a[k].strip() for k in ['name','description','prompt'])
   f=m.get('characterPromptFormat')
   if cat=='character' and f and f['id']!='original':a['characterPromptFormat']={'id':f['id'],'name':f['name'],'version':f['version'],'template':f['content']}
   a['extractionSourceTaskId']=row['id']
   existing=c.execute('select id,status from project_asset_candidates where project_id=? and unit_id=? and category=? and name in (?,?) order by case when name=? then 0 else 1 end limit 1',(pid,unit,cat,a['name'],rename.get(a['name'],a['name']),a['name'])).fetchone()
   if existing:
    if existing['status']=='confirmed':continue
    c.execute('update project_asset_candidates set details_json=?,updated_at=? where id=?',(json.dumps(a,ensure_ascii=False),now,existing['id']))
   else:
    c.execute('insert into project_asset_candidates (id,project_id,unit_id,shot_id,name,name_key,category,status,source,details_json,resolved_asset_id,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?)',(uuid.uuid4().hex,pid,unit,'',a['name'],re.sub(r'[\s·•・._-]+','',a['name'].lower()),cat,'pending_confirmation','chapter_character_extract',json.dumps(a,ensure_ascii=False),'',now,now))
   written+=1
print('Latest saved:',written,'Total:',[tuple(r) for r in c.execute('select category,count(*) from project_asset_candidates where project_id=? and unit_id=? group by category',(pid,unit))])
