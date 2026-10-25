from _audit_install_guard import guard_legacy_install
guard_legacy_install(__file__, allow_build_only=False)
import os,pathlib,shutil,datetime,subprocess,json
root=pathlib.Path(__file__).resolve().parent;assets=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/versions/1.3.13/web/dist/assets';stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S');changed=[]
shutil.copy2(root/'src/mention-clipboard.js',assets/'mention-clipboard.js')
for p in assets.glob('canvas-resource-mention-textarea-*.js'):
 s=p.read_text('utf8')
 if 'copyMentionSelection as RFClipboard' in s:continue
 anchor='onPaste:e=>{e.preventDefault(),we(e.clipboardData.getData(`text/plain`))}'
 # Patch only the verified editor implementation, preserving all other input logic.
 if s.count(anchor)!=1 or 'let n=S.current?Y(S.current):e' not in s:continue
 assert 'onCopy:' not in s,p.name
 out='import{copyMentionSelection as RFClipboard}from"./mention-clipboard.js";'+s.replace(anchor,'onCopy:e=>RFClipboard(e,e.currentTarget,L),'+anchor,1)
 stage=root/'build'/('clipboard-'+p.name);stage.write_text(out,encoding='utf8');subprocess.run(['node','--check',str(stage)],check=True)
 shutil.copy2(p,root/'backups'/('before-clipboard-'+stamp+'-'+p.name));p.write_text(out,encoding='utf8');changed.append(p.name)
(root/'build/mention-clipboard-install.json').write_text(json.dumps({'changed':changed,'timestamp':stamp},indent=2),encoding='utf8');print('Patched verified mention editors:',len(changed))
