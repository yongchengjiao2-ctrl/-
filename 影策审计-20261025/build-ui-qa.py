import pathlib,shutil,sqlite3,os,json
r=pathlib.Path(__file__).parent;project=r.parent/'character-prompt-formats';out=r/'ui-qa';out.mkdir(exist_ok=True)
for name in ['vendor-react-DaNkUq-_.js','rolldown-runtime-DAXXjFlN.js','preload-helper-CiYdU7ls.js']:
 shutil.copy2(project/'qa'/name,out/name)
for name in ['character-prompt-formats.js','character-extraction-rules.js','original-character-format.js','chapter-generation-control.js']:
 shutil.copy2(project/'src'/name,out/name)
db=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/data/open_ai_canvas.db'
with sqlite3.connect(db.as_uri()+'?mode=ro',uri=True) as c:rows=[dict(zip(['operation','name','version','enabled','content'],r)) for r in c.execute('select operation,name,version,enabled,content from prompt_templates where enabled=1')]
(out/'auth-DDR5hxJV.js').write_text('export const T=()=>{};export const F=async()=>({templates:'+json.dumps(rows,ensure_ascii=False)+'});',encoding='utf8')
(out/'task-center-CCDONRL0.js').write_text("export const i=()=>{};export const t=async id=>({id,status:'cancelled',providerCancelStatus:'not_tested'});",encoding='utf8')
(out/'index.html').write_text('''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>影策修复·隔离界面验收</title><style>body{font:16px sans-serif;background:#f4f5fa;color:#222}main{max-width:700px;margin:30px auto;padding:28px;background:white;border-radius:14px}button,select{padding:9px;margin:6px}section{margin:20px 0}</style><main><h1>影策修复·隔离界面验收</h1><p>真实组件；后台模板只读快照；取消接口为模拟，不创建生产任务。</p><div id="root"></div></main><script type="module">
import {Z as reactFactory,W as domFactory} from './vendor-react-DaNkUq-_.js';
import {CharacterFormatPicker} from './character-prompt-formats.js';
import {ChapterGenerationControl,chapterGenerationRegistry as registry} from './chapter-generation-control.js';
const React=reactFactory(),h=React.createElement;let handle;
function App(){return h(React.Fragment,null,h('h2',null,'提取模板'),h(CharacterFormatPicker,{react:React}),h('h2',null,'本章任务取消'),h('button',{onClick:()=>{handle=registry.start('audit','c');handle.onTaskUpdate({id:'qa-task',status:'running'})}},'模拟开始分镜任务'),h(ChapterGenerationControl,{react:React,projectId:'audit',chapterId:'c'}));}
domFactory().createRoot(document.getElementById('root')).render(h(App));
</script></html>''',encoding='utf8')
print(out)
