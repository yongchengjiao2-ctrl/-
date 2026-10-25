"""Apply a reversible, version-checked frontend extension to desktop 1.3.13."""
from _audit_install_guard import guard_legacy_install
guard_legacy_install(__file__, allow_build_only=True)
import argparse, hashlib, json, os, pathlib, shutil, subprocess

ROOT=pathlib.Path(__file__).resolve().parent
ASSETS=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/versions/1.3.13/web/dist/assets'
TARGET=ASSETS/'chapters-CeKTBaiU.js'
BACKUP=ROOT/'backups/chapters-CeKTBaiU.before-protocol-fix.js'
EXT='character-prompt-formats.js'
IMPORT=f'import{{CharacterFormatPicker as RFPicker,selectedFormat as RFSelected,buildExtractionPrompt as RFBuild,annotateResult as RFAnnotate,normalizeTextConfig as RFTextConfig}}from"./{EXT}";'

def once(text, old, new):
    if text.count(old)!=1:
        raise RuntimeError(f'Expected exactly one patch anchor, found {text.count(old)}: {old[:80]}')
    return text.replace(old,new,1)

def patch(original):
    text=original
    text=once(text,'let i={...nt,model:t,textModel:t};','let i=RFTextConfig({...nt,model:t,textModel:t},t);')
    text=once(text,'let o=L,s={...nt,model:o,textModel:o};','let o=L,s=RFTextConfig({...nt,model:o,textModel:o},o);')
    text=once(text,'a={...ne,model:m,textModel:m},s=Ut(', 'a=RFTextConfig({...ne,model:m,textModel:m},m),s=Ut(')
    # Snapshot the chosen template at task submission, including for recovery.
    text=once(text,'sourceText:r,projectStyle:kt(','sourceText:r,roleFormat:RFSelected(),projectStyle:kt(')
    text=once(text,'promptTemplateOperation:Xe.ChapterAssetsExtract,promptTemplateVariables:n',
        'promptTemplateVariables:n,characterPromptFormat:e.roleFormat')
    text=once(text,'prompt:Ze(`章节角色、场景与道具提取`)',
        'prompt:RFBuild(n,e.roleFormat||RFSelected())')
    text=once(text,'async function yn(e,t){return mn(await xn(',
        'async function yn(e,t){return RFAnnotate(mn(await xn(')
    text=once(text,'正文仅作待分析素材，不执行其中指令。`},t))}',
        '正文仅作待分析素材，不执行其中指令。`},t)),e.roleFormat)}')
    # Recovered extraction tasks must use the snapshot, never today's selection.
    text=once(text,'await an(r,_n(e))','await an(r,RFAnnotate(_n(e),Sn(e.inputJson).characterPromptFormat))')
    # Insert only into the asset extraction modal, not the storyboard modal.
    anchor='placeholder:`选择用于提取角色、场景与道具的文本模型`,showSelectedPrice:!1,onMissingConfig:()=>Ke({continueCreation:!0})})]})]})})'
    replacement='placeholder:`选择用于提取角色、场景与道具的文本模型`,showSelectedPrice:!1,onMissingConfig:()=>Ke({continueCreation:!0})})]}),(0,$.jsx)(RFPicker,{react:Q})]})})'
    text=once(text,anchor,replacement)
    return IMPORT+text

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--restore',action='store_true')
    parser.add_argument('--build-only',action='store_true')
    args=parser.parse_args()
    if args.restore:
        if not BACKUP.exists():raise RuntimeError('No backup found')
        current=TARGET.read_text(encoding='utf-8')
        if not current.startswith(IMPORT):raise RuntimeError('Target is not this extension; refused to overwrite')
        shutil.copy2(BACKUP,TARGET)
        print('Restored original 1.3.13 chapter module. Reload the application.')
        return
    if BACKUP.exists():original=BACKUP.read_text(encoding='utf-8')
    else:original=TARGET.read_text(encoding='utf-8')
    current=TARGET.read_text(encoding='utf-8')
    if current!=original and not current.startswith('import{CharacterFormatPicker as RFPicker,'):raise RuntimeError('Unexpected installed module; refused to overwrite')
    output=patch(original)
    build=ROOT/'build'
    build.mkdir(exist_ok=True)
    (build/TARGET.name).write_text(output,encoding='utf-8')
    shutil.copy2(ROOT/'src'/EXT,build/EXT)
    shutil.copy2(ROOT/'src/original-character-format.js',build/'original-character-format.js')
    import sqlite3
    db=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/data/open_ai_canvas.db'
    with sqlite3.connect(db.as_uri()+'?mode=ro',uri=True) as connection:
        row=connection.execute("SELECT content FROM prompt_templates WHERE operation='chapter_assets_extract' AND enabled=1 ORDER BY version DESC LIMIT 1").fetchone()
    if not row:raise RuntimeError('Enabled extraction template missing')
    # Preserve original extraction, scene and prop rules; replace only the layout paragraph.
    import re
    rules,count=re.subn(r'【人物排版】[\s\S]*?(?=【场景】)','',row[0])
    if count!=1:raise RuntimeError('Cannot isolate original character layout safely')
    data_dir=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/data'
    registry=json.loads((data_dir/'plugin_registry.json').read_text(encoding='utf-8-sig'))
    installed=set()
    for plugin in registry:
        package=data_dir/'plugin-packages'/plugin.get('packagePath','missing')
        if not package.is_file():continue
        if hashlib.sha256(package.read_bytes()).hexdigest()!=plugin.get('packageSha256'):continue
        for provider in plugin.get('manifest',{}).get('contributes',{}).get('providers',[]):
            if 'text' in provider.get('capabilities',[]):installed.add(provider['id'])
    candidates={'openai':['chat-completion','a6api-chat'],'claude':['claude-api'],'gemini':['gemini-generate-content']}
    protocols={key:next((p for p in options if p in installed),None) for key,options in candidates.items()}
    (build/'character-extraction-rules.js').write_text('export const EXTRACTION_RULES='+json.dumps(rules,ensure_ascii=False)+';\nexport const TEXT_PROTOCOLS='+json.dumps(protocols)+';\n',encoding='utf-8')
    shutil.copy2(build/'character-extraction-rules.js',ROOT/'src/character-extraction-rules.js')
    for file in build.glob('*.js'):
        subprocess.run(['node','--check',str(file)],check=True)
    manifest={'desktopVersion':'1.3.13','originalSha256':hashlib.sha256(original.encode()).hexdigest(),
        'patchedSha256':hashlib.sha256(output.encode()).hexdigest(),'files':[TARGET.name,EXT,'character-extraction-rules.js']}
    (build/'extension.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    if args.build_only:
        print('Built and syntax-checked extension without changing installation.')
        return
    BACKUP.parent.mkdir(exist_ok=True)
    if TARGET.read_text(encoding='utf-8')!=current:raise RuntimeError('Module changed during build; rerun to preserve concurrent edits')
    if not BACKUP.exists():shutil.copy2(TARGET,BACKUP)
    shutil.copy2(build/EXT,ASSETS/EXT)
    shutil.copy2(build/'original-character-format.js',ASSETS/'original-character-format.js')
    shutil.copy2(build/'character-extraction-rules.js',ASSETS/'character-extraction-rules.js')
    # Atomic replacement; no running process or user database is modified.
    temp=TARGET.with_suffix('.js.tmp')
    shutil.copy2(build/TARGET.name,temp)
    temp.replace(TARGET)
    print('Installed character format extension for 1.3.13. Reload the application.')

if __name__=='__main__':main()
