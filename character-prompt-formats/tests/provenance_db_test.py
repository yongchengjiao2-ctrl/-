import json, sqlite3, unittest, sys, uuid
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from provenance_db import install,backfill_completed_tasks

class ProvenanceTests(unittest.TestCase):
 def setUp(self):
  self.c=sqlite3.connect(':memory:');self.c.row_factory=sqlite3.Row
  self.c.executescript('''
   CREATE TABLE project_units(id TEXT PRIMARY KEY,project_id TEXT,title TEXT,position INTEGER);
   CREATE TABLE project_asset_candidates(id TEXT PRIMARY KEY,project_id TEXT,unit_id TEXT,shot_id TEXT,name TEXT,name_key TEXT,category TEXT,status TEXT,source TEXT,details_json TEXT,resolved_asset_id TEXT,created_at TEXT,updated_at TEXT,UNIQUE(project_id,category,name_key));
   CREATE TABLE assets(id TEXT PRIMARY KEY,title TEXT,category TEXT,primary_version_id TEXT,payload_json TEXT);
   CREATE TABLE asset_versions(id TEXT PRIMARY KEY,asset_id TEXT,version INTEGER,status TEXT,definition_json TEXT,prompt TEXT,note TEXT,created_at TEXT,updated_at TEXT);
   CREATE TABLE project_asset_links(project_id TEXT,asset_id TEXT);
   INSERT INTO project_units VALUES('u1','p','1',0),('u2','p','2',1),('u3','p','3',2),('q1','q','1',0);
  ''');install(self.c)
 def put(self,unit='u1',variant='',project='p',name='周虎',category='character',task=''):
  d={'name':name,'identityName':name,'extractionIdentityKey':name,'variantName':variant,'extractionVariantKey':variant or'default','extractionTaskId':task,'clothing':variant or'基础服装'}
  self.c.execute('INSERT OR IGNORE INTO project_asset_candidates VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',(uuid.uuid4().hex,project,unit,'',name,name,category,'pending_confirmation','chapter_character_extract',json.dumps(d,ensure_ascii=False),'','2026-10-25','2026-10-25'))
 def data(self):return json.loads(self.c.execute("SELECT details_json FROM project_asset_candidates WHERE project_id='p'").fetchone()[0])['extractionProvenance']
 def test_repeat_chapter_merges_source_without_duplicate_entity(self):
  self.put();self.put('u2');self.put('u2',task='retry')
  self.assertEqual(self.c.execute('SELECT count(*) FROM project_asset_candidates').fetchone()[0],1)
  p=self.data();self.assertEqual([s['chapterNumber']for s in p['sources']],[1,2]);self.assertEqual(len(p['variants']),1)
 def test_explicit_variant_keeps_its_own_chapter(self):
  self.put();self.put('u2','飞鱼服');self.put('u3','飞鱼服')
  variants={v['key']:v for v in self.data()['variants']}
  self.assertEqual(len(variants),2);self.assertEqual([s['chapterNumber']for s in variants['飞鱼服']['sources']],[2,3])
 def test_project_and_category_boundaries(self):
  self.put();self.put('q1',project='q');self.put('u2',name='周虎雕像',category='prop')
  p=json.loads(self.c.execute("SELECT details_json FROM project_asset_candidates WHERE project_id='p' AND name='周虎'").fetchone()[0])['extractionProvenance']
  self.assertEqual(len(p['sources']),1)
 def test_confirmed_asset_gets_variant_version_but_primary_does_not_change(self):
  self.put();self.c.execute("INSERT INTO assets VALUES('a','周虎','character','v1','{}')")
  self.c.execute("INSERT INTO asset_versions VALUES('v1','a',1,'confirmed','{}','','','','')")
  self.c.execute("UPDATE project_asset_candidates SET status='confirmed',resolved_asset_id='a'")
  self.put('u2','飞鱼服');self.put('u3','飞鱼服')
  self.assertEqual(self.c.execute("SELECT count(*) FROM asset_versions WHERE asset_id='a'").fetchone()[0],2)
  self.assertEqual(self.c.execute("SELECT primary_version_id FROM assets WHERE id='a'").fetchone()[0],'v1')
  self.assertEqual(json.loads(self.c.execute("SELECT definition_json FROM asset_versions WHERE version=2").fetchone()[0])['variantName'],'飞鱼服')
 def test_existing_linked_asset_is_reused(self):
  self.c.execute("INSERT INTO assets VALUES('a','周虎','character','v1','{}')")
  self.c.execute("INSERT INTO asset_versions VALUES('v1','a',1,'confirmed','{}','','','','')")
  self.c.execute("INSERT INTO project_asset_links VALUES('p','a')")
  self.put()
  r=self.c.execute('SELECT status,resolved_asset_id FROM project_asset_candidates').fetchone();self.assertEqual(tuple(r),('confirmed','a'))
 def test_first_explicit_costume_is_not_duplicated_when_confirmed(self):
  self.put(variant='囚服');self.c.execute("INSERT INTO assets VALUES('a','周虎','character','v1','{}')")
  self.c.execute("INSERT INTO asset_versions VALUES('v1','a',1,'confirmed','{}','','','','')")
  self.c.execute("UPDATE project_asset_candidates SET status='confirmed',resolved_asset_id='a'")
  self.assertEqual(self.c.execute("SELECT count(*) FROM asset_versions").fetchone()[0],1)
  self.put('u2','飞鱼服');self.put('u3','飞鱼服')
  self.assertEqual(self.c.execute("SELECT count(*) FROM asset_versions").fetchone()[0],2)
  self.assertIn('第2章、第3章',self.c.execute('SELECT note FROM asset_versions WHERE version=2').fetchone()[0])
 def test_complete_historical_tasks_recover_sources_but_truncation_does_not(self):
  self.put();self.c.execute('CREATE TABLE tasks(id TEXT,project_id TEXT,input_json TEXT,result_json TEXT,created_at TEXT,status TEXT)')
  for task,uid,text in [('complete','u2',json.dumps({'characters':[{'name':'周虎'}],'scenes':[],'props':[]})),('truncated','u3','{"characters":[')]:
   self.c.execute('INSERT INTO tasks VALUES(?,?,?,?,?,?)',(task,'p',json.dumps({'metadata':{'operation':'chapter_character_breakdown','chapterId':uid}}),json.dumps({'text':text}),'2026-10-26','succeeded'))
  self.assertEqual(backfill_completed_tasks(self.c),1)
  self.assertEqual([s['chapterNumber']for s in self.data()['sources']],[1,2])
 def test_creatures_scenes_and_props_all_keep_sources(self):
  for name,category in [('灵狼','character'),('皇宫','environment'),('绣春刀','prop')]:
   self.put(name=name,category=category);self.put('u2',name=name,category=category)
  self.assertEqual(self.c.execute('SELECT count(*) FROM project_asset_candidates').fetchone()[0],3)
  for r in self.c.execute('SELECT details_json FROM project_asset_candidates'):
   self.assertEqual(len(json.loads(r[0])['extractionProvenance']['sources']),2)

if __name__=='__main__':unittest.main()
