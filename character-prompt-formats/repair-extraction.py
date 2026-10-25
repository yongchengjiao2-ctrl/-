import pathlib,os,sqlite3,json,re,uuid,datetime,shutil
root=pathlib.Path(__file__).resolve().parent
app=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas'
db=app/'data/open_ai_canvas.db'
c=sqlite3.connect(db);c.row_factory=sqlite3.Row
ids=['4f25036035cd04bcafb1f1fa4afc76c2','70802a1272733fb2483f18ee9ceacc2d','221e5dd846ffcc7544a8cfc4fa4b8ec2']
rows={i:dict(c.execute('select * from tasks where id=?',(i,)).fetchone()) for i in ids}
meta=lambda r:json.loads(r['input_json'])['metadata']
source=lambda r:meta(r)['promptTemplateVariables']['章节正文']
norm=lambda s:re.sub(r'[\s*]+','',s)
assert norm(source(rows[ids[0]]))==norm(source(rows[ids[2]])), 'Source mismatch'
v=json.loads(json.loads(rows[ids[2]]['result_json'])['text'])
assert [len(v[k]) for k in ['characters','scenes','props']]==[10,4,5]
backup=root/'backups'/('extraction-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'));backup.mkdir(parents=True)
b=sqlite3.connect(backup/'database.db');c.backup(b);b.close()
p=app/'versions/1.3.13/web/dist/assets/chapters-CeKTBaiU.js';s=p.read_text(encoding='utf8');shutil.copy2(p,backup/p.name)
def once(a,b):
 global s
 assert s.count(a)==1,(a[:60],s.count(a));s=s.replace(a,b)
once('let n=gn(e);if(!n)return e;let i=X(n.chapterId,n.kind);','let n=gn(e);if(!n)return e;if(n.kind===`characters`&&e.status===`succeeded`){try{_n(e)}catch(t){return{...e,status:`failed`,error:`模型响应不完整或格式无效，资产未保存：${t.message}`}}}let i=X(n.chapterId,n.kind);')
once('Ue[X(V.id,`characters`)]||Pt.has(X(V.id,`characters`))||e.assetCandidates.some','Ue[X(V.id,`characters`)]||e.assetCandidates.some')
# Fail before the caller can label incomplete output as extracted; keep the original strict parser.
once('if(!a.text?.trim())throw Error(`模型没有返回可用结果`);return a.text','if(!a.text?.trim())throw Error(`模型没有返回可用结果`);try{mn(a.text)}catch(t){throw Error(`资产提取失败：响应不完整或不符合JSON合同，未保存资产。${t.message}`)}return a.text')
tmp=p.with_suffix('.tmp.js');tmp.write_text(s,encoding='utf8')
import subprocess
subprocess.run(['node','--check',str(tmp)],check=True);tmp.replace(p)
now=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat(' ')
pid=meta(rows[ids[0]])['domainProjectId'];unit=meta(rows[ids[0]])['chapterId']
with c:
 for tid in ids[:2]:
  c.execute("update tasks set status='failed',stage='failed',error=?,updated_at=? where id=? and status='succeeded'",('模型返回内容在JSON字符串中途截断，资产解析失败；完整同源结果已恢复到项目资产。',now,tid))
 for key,category in [('characters','character'),('scenes','environment'),('props','prop')]:
  for item in v[key]:
   exists=c.execute('select id from project_asset_candidates where project_id=? and unit_id=? and category=? and name=?',(pid,unit,category,item['name'])).fetchone()
   if exists:continue
   namekey=re.sub(r'[\s·•・._-]+','',item['name'].lower())
   c.execute('insert into project_asset_candidates (id,project_id,unit_id,shot_id,name,name_key,category,status,source,details_json,resolved_asset_id,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?)',(uuid.uuid4().hex,pid,unit,'',item['name'],namekey,category,'pending_confirmation','chapter_character_extract',json.dumps(item,ensure_ascii=False),'',now,now))
print('Restored counts:',[tuple(r) for r in c.execute('select category,count(*) from project_asset_candidates where project_id=? and unit_id=? group by category',(pid,unit))]);print('Backup:',backup)
