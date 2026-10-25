from _audit_install_guard import guard_legacy_install
guard_legacy_install(__file__, allow_build_only=False)
from pathlib import Path
import os, sqlite3, shutil, datetime, re, json, subprocess
from provenance_db import install,backfill,backfill_completed_tasks

root=Path(__file__).resolve().parent
home=Path(os.environ['LOCALAPPDATA'])/'YingceCanvas'
assets=home/'versions/1.3.13/web/dist/assets'
backup=root/'backups'/('asset-provenance-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
backup.mkdir(parents=True)

def save(p,text):
    if p.exists()and p.read_text('utf8')==text:return
    staged=root/'build'/('provenance-'+p.name);staged.write_text(text,'utf8')
    subprocess.run(['node','--check','--input-type=module'],input=text,text=True,encoding='utf8',check=True,capture_output=True)
    if p.exists():shutil.copy2(p,backup/p.name)
    p.write_text(text,'utf8')

save(assets/'asset-provenance.js',(root/'src/asset-provenance.js').read_text('utf8'))
p=root/'src/asset-extraction-runtime-v3.js';s=p.read_text('utf8')
if 'IDENTITY_RULES as RFIdentityRules'not in s:
    s="import {IDENTITY_RULES as RFIdentityRules,identityCatalog as RFIdentityCatalog,preserveIdentity as RFPreserveIdentity} from './asset-provenance.js';\n"+s
    s=s.replace('const characters=data.characters.length?parseCharacters(JSON.stringify(data)):[];','const characters=data.characters.length?RFPreserveIdentity(parseCharacters(JSON.stringify(data)),data.characters):[];')
    anchor='const prompt=buildExtractionPrompt(e.variables,e.roleFormat)'
    assert s.count(anchor)==1
    s=s.replace(anchor,"const knownIdentities=await RFIdentityCatalog(e.projectId);\n const prompt=RFIdentityRules+'\\n【已有资产身份目录，仅用于身份和造型对照】'+JSON.stringify(knownIdentities)+'\\n'+buildExtractionPrompt(e.variables,e.roleFormat)",1)
    p.write_text(s,'utf8')
save(assets/p.name,s)

p=assets/'chapters-CeKTBaiU.js';s=p.read_text('utf8')
if 'prepareCandidates as RFPrepareCandidates'not in s:
    s='import {prepareCandidates as RFPrepareCandidates} from "./asset-provenance.js";'+s
    anchor='await St(e.project.id,i,`chapter_character_extract`)';assert s.count(anchor)==1
    s=s.replace(anchor,'await St(e.project.id,RFPrepareCandidates(i,e.units,[...(e.assetCandidates||[]),...(e.assets||[])]),`chapter_character_extract`)',1)
    anchor='return{name:n.name.trim(),description:n.description.trim(),prompt:n.prompt.trim()}'
    assert s.count(anchor)==1;s=s.replace(anchor,'return{...n,name:n.name.trim(),description:n.description.trim(),prompt:n.prompt.trim()}',1)
    anchor='et(JSON.stringify({characters:n.characters})):[]'
    assert s.count(anchor)==1
    s=s.replace(anchor,'et(JSON.stringify({characters:n.characters})).map(c=>({...n.characters.find(raw=>raw.name===c.name),...c})):[]',1)
save(p,s)

# Enrich the compact asset-list DTOs with provenance from their existing candidates.
p=assets/'projects-DAnF4Ptj.js';s=p.read_text('utf8')
if 'enrichAssetProvenance as RFEnrichProvenance'not in s:
    s='import {enrichAssetProvenance as RFEnrichProvenance} from "./asset-provenance.js";'+s
    a='.then(e=>({...e,assets:e.assets.map(g)}))';assert s.count(a)==1
    s=s.replace(a,'.then(async r=>({...r,assets:await RFEnrichProvenance(e,r.assets.map(g))}))',1)
    a='.then(e=>({assets:e.assets.map(g)}))';assert s.count(a)==1
    s=s.replace(a,'.then(async r=>({assets:await RFEnrichProvenance(e,r.assets.map(g))}))',1)
save(p,s)

patched=[]
for p in assets.glob('assets-*.js'):
    s=p.read_text('utf8')
    if '来自章节分析'not in s or 'provenancePanel as RFProvenancePanel'in s:continue
    # All release variants use the same components, with their own JSX runtime names.
    s='import {sourceLabel as RFSourceLabel,provenancePanel as RFProvenancePanel} from "./asset-provenance.js";'+s
    m=re.search(r'function \w+\(\{detail:(\w+),refreshProject:\w+\}\)\{',s);assert m,p.name
    s=s[:m.end()]+f'let RFUnits={m[1]}.units||[];'+s[m.end():]
    a='` · 来自章节分析`';assert s.count(a)==1
    s=s.replace(a,'` · `,RFSourceLabel(e,RFUnits)',1)
    pattern=r'(,\(0,(\w+)\.jsxs\)\(`div`,\{className:`mt-2 flex min-w-0 flex-wrap items-center gap-1`)'
    s,n=re.subn(pattern,lambda m:',RFProvenancePanel(e,RFUnits,'+m[2]+')'+m[1],s);assert n==1,(p.name,n)
    for cls in ['project-character-card','project-asset-library-card']:
        pattern=r'(return\(0,(\w+)\.jsxs\)\(\w+,\{className:`'+cls+r'`,children:\[)'
        s,n=re.subn(pattern,lambda m:m[1]+'RFProvenancePanel(e,[],'+m[2]+'),',s);assert n==1,(p.name,cls,n)
    save(p,s);patched.append(p.name)

db=home/'data/open_ai_canvas.db'
with sqlite3.connect(db)as c,sqlite3.connect(backup/'database.db')as dest:c.backup(dest)
with sqlite3.connect(db,timeout=30)as c:
    c.row_factory=sqlite3.Row
    install(c)
    first=backfill(c);recovered=backfill_completed_tasks(c)
    c.commit()
    report={'backup':str(backup),'candidateObservations':first,'recoveredTaskObservations':recovered,'uiModules':len(patched),
      'observations':c.execute('SELECT count(*) FROM yingce_extraction_observations').fetchone()[0]}
(root/'build/asset-provenance-install.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf8')
print(json.dumps(report,ensure_ascii=True))
