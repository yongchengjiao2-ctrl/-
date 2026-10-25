import sqlite3,pathlib,os,json,re
out=pathlib.Path(__file__).parent
base=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas';a=base/'versions/1.3.13/web/dist/assets'
c=sqlite3.connect((base/'data/open_ai_canvas.db').as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
def rows(q):return [dict(r) for r in c.execute(q)]
report={}
report['skill_entry_paths']=rows('select entry_path,count(*) n from skill_versions group by entry_path')
report['skill_metadata']=rows('select s.id,s.name,s.status,s.file_count,s.sync_status,s.auto_update,v.entry_path from skills s left join skill_versions v on v.id=s.current_version_id')
report['skill_integrity']={
 'missing_version':rows('select count(*) n from skills s left join skill_versions v on v.id=s.current_version_id where v.id is null'),
 'installed_version_missing':rows('select count(*) n from user_skill_states s left join skill_versions v on v.id=s.installed_version_id where s.added=1 and v.id is null'),
 'file_count_mismatch':rows('select v.id,v.file_count,count(f.id) actual from skill_versions v left join skill_files f on f.skill_version_id=v.id group by v.id having v.file_count!=count(f.id)')}
report['character_prompt_missing']=[]
for r in rows("select a.id,a.title,v.definition_json,v.prompt from assets a join asset_versions v on a.primary_version_id=v.id where a.category='character'"):
 try:d=json.loads(r.pop('definition_json') or '{}')
 except:d={}
 if not d.get('multiViewPrompt','').strip():report['character_prompt_missing'].append({'id':r['id'],'title':r['title'],'has_version_prompt':bool(r['prompt'])})
report['settings_menu']=list(dict.fromkeys(re.findall(r'(?:key|label|title):`([^`]{1,90})`',(a/'settings-D8GTFmm6.js').read_text('utf8'))))
report['task_types']=rows('select type,operation,status,count(*) n from tasks group by type,operation,status')
report['task_business_validation']=[]
for r in rows("select id,operation,status,result_json,input_json from tasks where status='succeeded'"):
 try:inp=json.loads(r.pop('input_json') or '{}');result=json.loads(r.pop('result_json') or '{}')
 except:continue
 meta=inp.get('metadata',{});text=result.get('text','')
 if not isinstance(text,str):continue
 business=meta.get('operation',meta.get('source',''))
 r.update(business_operation=business,text_chars=len(text),is_json=False)
 try:
  p=json.loads(text.strip().removeprefix('```json').removesuffix('```').strip());r.update(is_json=True,keys=list(p) if isinstance(p,dict) else ['array'])
 except:pass
 report['task_business_validation'].append(r)
(out/'extra-inventory.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k not in ['skill_metadata','task_business_validation']},ensure_ascii=False,indent=2))
