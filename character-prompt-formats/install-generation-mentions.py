from _audit_install_guard import guard_legacy_install
guard_legacy_install(__file__, allow_build_only=False)
import pathlib,os,datetime,shutil,subprocess
r=pathlib.Path('character-prompt-formats');a=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/versions/1.3.13/web/dist/assets';p=a/'chapters-CeKTBaiU.js';s=p.read_text(encoding='utf8');b=r/'backups'/('generation-mentions-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'));b.mkdir(parents=True);shutil.copy2(p,b/p.name);shutil.copy2(a/'shot-asset-bindings.js',b/'shot-asset-bindings.js')
old='repairStoredProject as RFRepair,PRESENTATION_RULES as RFPresentationRules';assert s.count(old)==1;s=s.replace(old,'repairStoredProject as RFRepair,prepareShotRows as RFPrepareRows,PRESENTATION_RULES as RFPresentationRules')
old='let r=nn(n,e);return await yt';assert s.count(old)==1;s=s.replace(old,'let r=RFPrepareRows(nn(n,e),e,t);return await yt')
old='await yt(e.project.id,t,r,e.shots.filter(e=>e.unitId===t).map(e=>e.id)),await Promise.all';assert s.count(old)==1;s=s.replace(old,'await yt(e.project.id,t,r,e.shots.filter(e=>e.unitId===t).map(e=>e.id)),await RFRepair(e.project.id),await Promise.all')
# Old completed tasks must never overwrite existing storyboards: reconcile references only.
old='if(kn(n,r,a,e)){ft.current.add(n.id),$t(r,a);continue}'
new='if(kn(n,r,a,e)||a===`storyboard`&&e.shots.some(t=>t.unitId===r)){ft.current.add(n.id),$t(r,a);if(a===`storyboard`){RFRepair(e.project.id).then(()=>t()).catch(t=>i.error(`分镜引用补全失败：${t.message}`))}continue}'
assert s.count(old)==1;s=s.replace(old,new)
p.write_text(s,encoding='utf8');shutil.copy2(r/'src/shot-asset-bindings.js',a/'shot-asset-bindings.js')
for p in [p,a/'shot-asset-bindings.js']:subprocess.run(['node','--check',str(p)],check=True)
print('Installed pre-save binding, post-save and restored-task repair; existing shot protection.')
