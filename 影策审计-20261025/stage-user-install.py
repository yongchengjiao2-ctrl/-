import pathlib,os,json,hashlib,re,shutil
root=pathlib.Path(__file__).parent
source=root.parent/'character-prompt-formats/src'
assets=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/versions/1.3.13/web/dist/assets'
stage=root/'user-install-stage'
assert not (root/'user-install-plan.json').exists(), 'Review plan already exists; do not silently restage'
stage.mkdir(exist_ok=True)
names=['chapters-CeKTBaiU.js','chapter-generation-control.js','storyboard-planned.js','json-unique-keys.js','extraction-section-provenance.js','extraction-source-inventory.js','storyboard-planned-runtime.js']
for name in names:
 if name!='storyboard-planned-runtime.js':shutil.copy2(source/name,stage/name)
runtime=(assets/'storyboard-planned-runtime.js').read_text(encoding='utf8')
assert 'storyboardPlanVersion:4' in runtime
old="if(choice==='retry')continue;"
assert runtime.count(old)==1
runtime=runtime.replace(old,"if(choice==='retry'){await callbacks.onReviewRetry?.();if(signal?.aborted)throw new DOMException('Aborted','AbortError');continue;}")
old='const result=renderPlanned(raw,plan),errors='
assert runtime.count(old)==1
runtime=runtime.replace(old,'const result=renderPlanned(raw,plan,{contentContract:metadata.plannedContentContract||0}),errors=')
(stage/'storyboard-planned-runtime.js').write_text(runtime,encoding='utf8')
# Testing uses the same unchanged installed dependencies, not unreviewed src copies.
queue=['storyboard-planned-runtime.js','storyboard-planned.js','extraction-section-provenance.js'];seen=set()
while queue:
 name=queue.pop()
 if name in seen:continue
 seen.add(name)
 text=(stage/name).read_text(encoding='utf8')
 for _,dep in re.findall(r'(?:from\s*|import\s*\()(["\x27`])\./([^"\x27`]+\.js)\1',text):
  if not (stage/dep).exists():shutil.copy2(assets/dep,stage/dep)
  # Lazy application imports are checked by installer, not executed by smoke tests.
  if dep!='task-center-CCDONRL0.js':queue.append(dep)
(stage/'package.json').write_text('{"type":"module"}',encoding='utf8')
manifest={'files':names,'allowCreate':[n for n in names if not (assets/n).exists()], 'sha256':{n:hashlib.sha256((stage/n).read_bytes()).hexdigest() for n in names},'preservedMode':'autonomous-director-v4','extractionRuntimeChanged':False,'fixedPlanContract5Activated':False}
(root/'user-install-plan.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(manifest,ensure_ascii=False))
