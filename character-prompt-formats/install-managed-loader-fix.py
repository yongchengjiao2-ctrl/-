from _audit_install_guard import guard_legacy_install
guard_legacy_install(__file__, allow_build_only=False)
from pathlib import Path
import os,shutil,datetime,subprocess
root=Path(__file__).resolve().parent
assets=Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/versions/1.3.13/web/dist/assets'
backup=root/'backups'/('managed-loader-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'));backup.mkdir()
for name in ['character-prompt-formats.js','extraction-completeness-v4.js','asset-extraction-runtime-v3.js']:
 source=root/'src'/name;target=assets/name
 subprocess.run(['node','--check',str(source)],check=True)
 if target.exists():shutil.copy2(target,backup/name)
 shutil.copy2(source,target)
chapter=assets/'chapters-CeKTBaiU.js';text=chapter.read_text('utf8')
old='requestExtraction as RFRequestExtraction}'
if old in text:
 updated=text.replace(old,'requestExtraction as RFRequestExtraction,validateRecoveredExtraction as RFValidateRecovered}',1)
 anchor=':mn(t.text)}function vn(e)';assert updated.count(anchor)==1
 updated=updated.replace(anchor,':RFValidateRecovered(t.text,Sn(e.inputJson))}function vn(e)',1)
 subprocess.run(['node','--check','--input-type=module'],input=updated,text=True,encoding='utf8',check=True,capture_output=True)
 shutil.copy2(chapter,backup/chapter.name);chapter.write_text(updated,'utf8')
print('Installed loader and recovery fixes. No model requests or project writes.')
