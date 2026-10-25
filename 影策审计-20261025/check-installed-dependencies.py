import os,pathlib,re,json,subprocess,hashlib
r=pathlib.Path(__file__).parent;a=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/versions/1.3.13/web/dist/assets'
names=['chapters-CeKTBaiU.js','asset-extraction-runtime-v3.js','character-prompt-formats.js','extraction-completeness-v4.js','shot-asset-bindings.js','storyboard-complete.js','storyboard-detail-normalize.js','storyboard-planned.js','storyboard-planned-runtime.js','skill-runtime-CF8drDK4.js','chapter-generation-control.js','assets-BpSjmEjz.js','workflow-production-workbench-DLsty33y.js']
seen=set();missing=[];results=[]
while names:
 n=names.pop()
 if n in seen:continue
 seen.add(n);p=a/n
 if not p.exists():missing.append(n);continue
 s=p.read_text('utf8');deps=[x[1].split('?',1)[0] for x in re.findall(r'(?:from\s*|import\s*\()(["\x27`])\./([^"\x27`]+\.js(?:\?[^"\x27`]+)?)\1',s)]
 for dep in deps:
  if not (a/dep).exists():missing.append(n+' -> '+dep)
 # Follow custom audit modules only; vendor bundles are included as existing dependencies.
 names.extend(dep for dep in deps if '-' not in dep.removesuffix('.js') or dep in ['asset-provenance.js','storyboard-human-review.js'])
 syntax=subprocess.run(['node','--input-type=module','--check'],input=s,encoding='utf8',capture_output=True)
 results.append({'name':n,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'syntaxPassed':syntax.returncode==0,'syntaxError':syntax.stderr[:400],'dependencies':deps})
out={'checkedInstalledModules':len(results),'missing':missing,'syntaxPassed':all(x['syntaxPassed'] for x in results),'files':results}
(r/'installed-dependency-check.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8');print('checked',len(results),'missing',missing,'syntax',out['syntaxPassed'])
raise SystemExit(0 if not missing and out['syntaxPassed'] else 1)
