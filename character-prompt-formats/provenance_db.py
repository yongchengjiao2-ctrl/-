"""Additive extraction history for the installed desktop's existing SQLite store.

BEFORE INSERT observes even the backend's ON CONFLICT DO NOTHING requests.
Only explicit identity names and explicit variant labels are merged. No model call.
"""
import json, sqlite3, uuid, re

SCHEMA = r'''
CREATE TABLE IF NOT EXISTS yingce_extraction_observations (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL, category TEXT NOT NULL,
 entity_key TEXT NOT NULL, identity_name TEXT NOT NULL,
 unit_id TEXT NOT NULL, chapter_number INTEGER, chapter_title TEXT,
 variant_key TEXT NOT NULL, variant_name TEXT NOT NULL,
 task_id TEXT NOT NULL DEFAULT '', details_json TEXT NOT NULL,
 created_at TEXT NOT NULL,
 UNIQUE(project_id,category,entity_key,unit_id,variant_key,task_id)
);
CREATE VIEW IF NOT EXISTS yingce_extraction_sources AS
 SELECT project_id,category,entity_key,unit_id,min(chapter_number) chapter_number,
 chapter_title,min(created_at) first_seen
 FROM yingce_extraction_observations GROUP BY project_id,category,entity_key,unit_id;
CREATE VIEW IF NOT EXISTS yingce_extraction_variants AS
 SELECT o.project_id,o.category,o.entity_key,o.variant_key,o.variant_name,
 (SELECT d.details_json FROM yingce_extraction_observations d WHERE
 d.project_id=o.project_id AND d.category=o.category AND d.entity_key=o.entity_key
 AND d.variant_key=o.variant_key ORDER BY d.created_at,d.id LIMIT 1) details_json
 FROM yingce_extraction_observations o GROUP BY o.project_id,o.category,o.entity_key,o.variant_key;
CREATE VIEW IF NOT EXISTS yingce_extraction_rollups AS
 SELECT v.project_id,v.category,v.entity_key,json_object(
 'schemaVersion',1,
 'sources',json((SELECT json_group_array(json_object('unitId',s.unit_id,
 'chapterNumber',s.chapter_number,'chapterTitle',s.chapter_title,'firstSeen',s.first_seen))
 FROM yingce_extraction_sources s WHERE s.project_id=v.project_id AND s.category=v.category AND s.entity_key=v.entity_key)),
 'variants',json((SELECT json_group_array(json_object('key',a.variant_key,'name',a.variant_name,
 'details',json(a.details_json),'sources',json((SELECT json_group_array(json_object(
 'unitId',u.unit_id,'chapterNumber',u.chapter_number,'chapterTitle',u.chapter_title))
 FROM (SELECT unit_id,chapter_number,chapter_title FROM yingce_extraction_observations x WHERE
 x.project_id=a.project_id AND x.category=a.category AND x.entity_key=a.entity_key
 AND x.variant_key=a.variant_key GROUP BY unit_id ORDER BY chapter_number,unit_id) u))))
 FROM yingce_extraction_variants a WHERE a.project_id=v.project_id AND a.category=v.category AND a.entity_key=v.entity_key))
 ) provenance_json FROM yingce_extraction_variants v GROUP BY v.project_id,v.category,v.entity_key;
'''

def key(text):
    return re.sub(r'[\s·•・《》〈〉「」『』【】\[\]（）()、，,:：。;；\-—_]', '', text).casefold()

def rollup_for(alias):
    return f'''(SELECT provenance_json FROM yingce_extraction_rollups r WHERE
 r.project_id={alias}.project_id AND r.category={alias}.category AND
 r.entity_key=coalesce(nullif(json_extract({alias}.details_json,'$.extractionIdentityKey'),''),{alias}.name_key))'''

def sync_sql(alias='NEW'):
    provenance=rollup_for(alias)
    return f'''
 UPDATE asset_versions SET definition_json=json_set(CASE WHEN json_valid(definition_json) THEN definition_json ELSE '{{}}' END,
 '$.extractionProvenance',json({provenance})) WHERE asset_id={alias}.resolved_asset_id AND {provenance} IS NOT NULL;
 UPDATE asset_versions SET definition_json=json_set(definition_json,'$.extractionVariantKey',coalesce(json_extract({alias}.details_json,'$.extractionVariantKey'),'default'))
 WHERE id=(SELECT primary_version_id FROM assets WHERE id={alias}.resolved_asset_id)
 AND json_extract(definition_json,'$.extractionVariantKey') IS NULL;
 UPDATE assets SET payload_json=json_set(CASE WHEN json_valid(payload_json) THEN payload_json ELSE '{{}}' END,
 '$.extractionProvenance',json({provenance})) WHERE id={alias}.resolved_asset_id AND {provenance} IS NOT NULL;
 INSERT INTO asset_versions(id,asset_id,version,status,definition_json,prompt,note,created_at,updated_at)
 SELECT lower(hex(randomblob(16))),{alias}.resolved_asset_id,
 (SELECT coalesce(max(version),0) FROM asset_versions WHERE asset_id={alias}.resolved_asset_id)+row_number() OVER(ORDER BY v.variant_key),
 'confirmed',json_set(v.details_json,'$.extractionVariantKey',v.variant_key,'$.variantName',v.variant_name,
 '$.extractionProvenance',json({provenance})),coalesce(json_extract(v.details_json,'$.multiViewPrompt'),json_extract(v.details_json,'$.prompt'),''),
 '章节提取造型/状态：'||v.variant_name,datetime('now'),datetime('now')
 FROM yingce_extraction_variants v WHERE v.project_id={alias}.project_id AND v.category={alias}.category
 AND v.entity_key=coalesce(nullif(json_extract({alias}.details_json,'$.extractionIdentityKey'),''),{alias}.name_key)
 AND v.variant_key<>'default' AND {alias}.status='confirmed' AND length({alias}.resolved_asset_id)>0
 AND NOT EXISTS(SELECT 1 FROM asset_versions av WHERE av.asset_id={alias}.resolved_asset_id
 AND json_extract(av.definition_json,'$.extractionVariantKey')=v.variant_key);
 UPDATE asset_versions SET note='章节提取造型/状态：'||coalesce(json_extract(definition_json,'$.variantName'),'')||' · 来源：'||
 (SELECT group_concat(label,'、') FROM (SELECT '第'||o.chapter_number||'章' label FROM yingce_extraction_observations o
 WHERE o.project_id={alias}.project_id AND o.category={alias}.category
 AND o.entity_key=coalesce(nullif(json_extract({alias}.details_json,'$.extractionIdentityKey'),''),{alias}.name_key)
 AND o.variant_key=json_extract(asset_versions.definition_json,'$.extractionVariantKey') GROUP BY o.unit_id ORDER BY o.chapter_number))
 WHERE asset_id={alias}.resolved_asset_id AND json_extract(definition_json,'$.extractionVariantKey')<>'default';
'''

def install(c):
    c.executescript(SCHEMA)
    for name in ['observe','rollup','after_insert','sync']:
        c.execute('DROP TRIGGER IF EXISTS yingce_provenance_'+name)
    refresh=f'''UPDATE project_asset_candidates SET details_json=json_set(details_json,'$.extractionProvenance',json({rollup_for('project_asset_candidates')}))
 WHERE project_id=NEW.project_id AND category=NEW.category AND
 coalesce(nullif(json_extract(details_json,'$.extractionIdentityKey'),''),name_key)=NEW.entity_key;'''
    c.executescript(f'''
 CREATE TRIGGER yingce_provenance_observe BEFORE INSERT ON project_asset_candidates
 WHEN NEW.source='chapter_character_extract' AND length(NEW.unit_id)>0 AND json_valid(NEW.details_json)
 BEGIN
 INSERT OR IGNORE INTO yingce_extraction_observations
 SELECT lower(hex(randomblob(16))),NEW.project_id,NEW.category,
 coalesce(nullif(json_extract(NEW.details_json,'$.extractionIdentityKey'),''),NEW.name_key),
 coalesce(nullif(json_extract(NEW.details_json,'$.identityName'),''),NEW.name),NEW.unit_id,
 1+(SELECT count(*) FROM project_units p WHERE p.project_id=NEW.project_id AND (p.position<u.position OR (p.position=u.position AND p.id<u.id))),u.title,
 coalesce(nullif(json_extract(NEW.details_json,'$.extractionVariantKey'),''),'default'),
 coalesce(nullif(json_extract(NEW.details_json,'$.variantName'),''),'基础造型/状态'),
 coalesce(json_extract(NEW.details_json,'$.extractionTaskId'),''),json_remove(NEW.details_json,'$.extractionProvenance'),coalesce(NEW.created_at,datetime('now'))
 FROM project_units u WHERE u.id=NEW.unit_id AND u.project_id=NEW.project_id;
 END;
 CREATE TRIGGER yingce_provenance_rollup AFTER INSERT ON yingce_extraction_observations
 BEGIN {refresh} END;
 CREATE TRIGGER yingce_provenance_after_insert AFTER INSERT ON project_asset_candidates
 WHEN NEW.source='chapter_character_extract' AND json_valid(NEW.details_json)
 BEGIN
 UPDATE project_asset_candidates SET details_json=json_set(details_json,'$.extractionProvenance',json({rollup_for('NEW')})) WHERE id=NEW.id AND {rollup_for('NEW')} IS NOT NULL;
 UPDATE project_asset_candidates SET status='confirmed',resolved_asset_id=(SELECT a.id FROM assets a JOIN project_asset_links l ON l.asset_id=a.id
 WHERE l.project_id=NEW.project_id AND a.category=NEW.category AND a.title=NEW.name LIMIT 1)
 WHERE id=NEW.id AND NEW.status='pending_confirmation' AND EXISTS(SELECT 1 FROM assets a JOIN project_asset_links l ON l.asset_id=a.id
 WHERE l.project_id=NEW.project_id AND a.category=NEW.category AND a.title=NEW.name);
 END;
 CREATE TRIGGER yingce_provenance_sync AFTER UPDATE OF details_json,resolved_asset_id,status ON project_asset_candidates
 WHEN NEW.status='confirmed' AND length(NEW.resolved_asset_id)>0 AND json_valid(NEW.details_json)
 BEGIN {sync_sql()} END;
 ''')

def backfill(c):
    rows=c.execute("SELECT c.*,u.title,u.position FROM project_asset_candidates c JOIN project_units u ON u.id=c.unit_id WHERE c.source='chapter_character_extract'").fetchall()
    columns=[x[0] for x in c.description] if hasattr(c,'description') else None
    count=0
    for row in rows:
        r=dict(row);d=json.loads(r['details_json'] or '{}')
        ordinal=1+c.execute('SELECT count(*) FROM project_units WHERE project_id=? AND (position<? OR (position=? AND id<?))',(r['project_id'],r['position'],r['position'],r['unit_id'])).fetchone()[0]
        values=(uuid.uuid4().hex,r['project_id'],r['category'],d.get('extractionIdentityKey')or r['name_key'],d.get('identityName')or r['name'],r['unit_id'],ordinal,r['title'],d.get('extractionVariantKey')or'default',d.get('variantName')or'基础造型/状态',d.get('extractionTaskId')or'',json.dumps({k:v for k,v in d.items()if k!='extractionProvenance'},ensure_ascii=False),r['created_at'])
        count+=c.execute('INSERT OR IGNORE INTO yingce_extraction_observations VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',values).rowcount
    return count

def backfill_completed_tasks(c):
    """Recover chapter attribution only from complete saved extraction responses.

    It never creates missing assets or guesses an old visual variant from prose.
    """
    known={}
    for r in c.execute('SELECT * FROM project_asset_candidates'):
        d=json.loads(r['details_json']or'{}');k=(r['project_id'],r['category'],key(d.get('identityName')or r['name']))
        known[k]=r
    inserted=0
    for task in c.execute("SELECT id,project_id,input_json,result_json,created_at FROM tasks WHERE status='succeeded' AND length(result_json)>0"):
        try:
            meta=json.loads(task['input_json']or'{}').get('metadata',{})
            if meta.get('operation')not in ('chapter_character_breakdown','chapter_assets_extract'):continue
            uid=meta.get('chapterId');unit=c.execute('SELECT * FROM project_units WHERE id=? AND project_id=?',(uid,task['project_id'])).fetchone()
            if not unit:continue
            text=json.loads(task['result_json'])['text'].strip()
            if text.startswith('```'):text=re.sub(r'^```(?:json)?\s*|\s*```$','',text,flags=re.I)
            data=json.loads(text)
            if not all(isinstance(data.get(k),list)for k in ('characters','scenes','props')):continue
            ordinal=1+c.execute('SELECT count(*) FROM project_units WHERE project_id=? AND (position<? OR (position=? AND id<?))',(unit['project_id'],unit['position'],unit['position'],uid)).fetchone()[0]
            for field,category in [('characters','character'),('scenes','environment'),('props','prop')]:
                for d in data[field]:
                    if not isinstance(d,dict)or not isinstance(d.get('name'),str):continue
                    existing=known.get((task['project_id'],category,key(d.get('identityName')or d['name'])))
                    if not existing:continue
                    ek=json.loads(existing['details_json']or'{}').get('extractionIdentityKey')or existing['name_key']
                    values=(uuid.uuid4().hex,task['project_id'],category,ek,existing['name'],uid,ordinal,unit['title'],'default','基础造型/状态',task['id'],json.dumps(d,ensure_ascii=False),task['created_at'])
                    inserted+=c.execute('INSERT OR IGNORE INTO yingce_extraction_observations VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',values).rowcount
        except (ValueError,KeyError,TypeError):continue
    return inserted
