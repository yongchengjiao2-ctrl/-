from pathlib import Path
p=Path(__file__).parent
s=(p/'repair-live-storyboard.mjs').read_text('utf8').replace('repair-live-storyboard-','repair-live-storyboard-v2-')
a=s.index('// A small real workflow');b=s.index('let submissions=',a)
s=s[:a]+r'''const packageData=JSON.parse(fs.readFileSync(new URL('repair-live-storyboard-real-skill-package.json',root),'utf8'));
const skill={skillId:packageData.id,skillName:packageData.name,isAdded:true,versionId:packageData.version_id,version:packageData.version_label};
const installedRuntime=fs.readFileSync(path.join(process.env.LOCALAPPDATA,'YingceCanvas/versions/1.3.13/web/dist/assets/skill-runtime-CF8drDK4.js'),'utf8');
const installedBody=installedRuntime.slice(installedRuntime.indexOf('function i('),installedRuntime.indexOf('var S,C,w,T,E,D='));
const installedFactory=new Function('r','n',installedBody+`;let S={shortDrama:{delivery:'linked-context',maxSkills:4,maxContextChars:32000,maxLinkedFilesPerSkill:3}};let C=/@\[skill:([^\]]+)\]/g;let w=new Set(['.md','.mdx','.txt','.json','.yaml','.yml','.toml','.csv']);let T={skillIds:[],skillVersions:[],skillFiles:[]};return s;`)(()=>{},()=>{});
const readFiles=[];
const runtime=installedFactory({getFile:async(id,name)=>{const f=packageData.files[name];if(!f)throw Error('Missing installed Skill file '+name);readFiles.push({path:name,chars:f.content.length,sha256:f.sha256});return {file:{binary:false,content:f.content,file:{sha256:f.sha256}}};},listFiles:async()=>({files:Object.keys(packageData.files).map(path=>({path,kind:'text'}))})});
if(!replay&&fs.existsSync(new URL('repair-live-storyboard-v2-response.json',root)))throw Error('One-call budget already consumed; only --replay is allowed');
''' +s[b:]
s=s.replace("skillTest:'synthetic workflow reference; real Skill Runtime'","skillTest:'actual installed ZIP files and installed Skill Runtime',skillReadFiles:readFiles")
s=s.replace('prepare:async e=>{const p=await runtime.prepare(e);',"reviewDraft:async draft=>{save('repair-live-storyboard-v2-review-draft.json',draft);return 'ack';},reviewStorage:{getItem:()=>null,setItem:()=>{throw Error('isolated test does not persist production review storage');}},prepare:async e=>{const p=await runtime.prepare(e);")
(p/'repair-live-storyboard-v2.mjs').write_text(s,'utf8')
