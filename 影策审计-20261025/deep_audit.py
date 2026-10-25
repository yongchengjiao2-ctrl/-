exec((__import__('pathlib').Path(__file__).parent.parent/'audit_yingce.py').read_text('utf8').split("for key,q in")[0])
report={}
report['schema']={t:rows('pragma table_info('+t+')') for t in ['skills','skill_versions','skill_files','user_skill_states','tasks','system_settings']}
report['templates']=rows('select operation,name,version,enabled,output_type,content from prompt_templates')
report['tasks']=rows('select id,operation,model,status,stage,length(result_json) result_length,error,created_at from tasks order by created_at desc limit 30') if 'result_json' in [r['name'] for r in report['schema']['tasks']] else []
report['integrity']=rows('pragma quick_check')
report['fk']=rows('pragma foreign_key_check')
report['orphans']={}
for key,q in {'shot_current_revision':'select count(*) n from shots s left join shot_revisions r on s.current_revision_id=r.id where r.id is null','reference_versions':'select count(*) n from shot_asset_references s left join asset_versions v on v.id=s.asset_version_id where v.id is null','confirmed_candidates':'select count(*) n from project_asset_candidates c left join assets a on a.id=c.resolved_asset_id where c.status="confirmed" and a.id is null','canvas_project':'select count(*) n from canvas_projects c left join projects p on p.id=c.project_id where coalesce(c.project_id,"")!="" and p.id is null'}.items():
 try:report['orphans'][key]=rows(q)
 except Exception as e:report['orphans'][key]=str(e)
report['skills']=rows('select id,name from skills')
report['skill_states']=rows('select * from user_skill_states')
report['canvases']=[]
for row in rows('select id,project_id,title,payload_json,revision from canvas_projects'):
 p=json.loads(row.pop('payload_json') or '{}');nodes=p.get('nodes',[]);connections=p.get('connections',p.get('edges',[]));ids={n.get('id') for n in nodes};row.update(node_count=len(nodes),connections=len(connections),types=dict(collections.Counter(n.get('type') for n in nodes)),payload_keys=list(p),bad_connections=[e for e in connections if (e.get('fromNodeId',e.get('sourceNodeId',e.get('source'))) not in ids or e.get('toNodeId',e.get('targetNodeId',e.get('target'))) not in ids)])
 report['canvases'].append(row)
out=pathlib.Path(__file__).parent
(out/'deep-inventory.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
for name in ['settings-navigation-BjiOtoD3.js','settings-D8GTFmm6.js','settings-B9H2OwlU.js','skill-runtime-CF8drDK4.js','project-chapter-storyboard-d54x9504.js','canvas-project-generation-DKqeyZxD.js','canvas-prompt-optimizer-drawer-C6erOSTO.js','prompts-C9Ts6kIN.js','storyboard-prompts-page-DRwECkxS.js']:
 (out/'code'/name).write_text((AS/name).read_text('utf8').replace(';',';\n'),encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k not in ['schema','templates','skill_states','tasks','skills']},ensure_ascii=False,indent=2))
print('templates',json.dumps([{k:v for k,v in r.items() if k!='content'} for r in report['templates']],ensure_ascii=False))
print('skill schemas',json.dumps({k:[r['name'] for r in v] for k,v in report['schema'].items()},ensure_ascii=False))
