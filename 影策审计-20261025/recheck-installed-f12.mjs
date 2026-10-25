import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import crypto from 'node:crypto';
import {normalizeDetailedRows as sourceNormalize,assertDetailedRows as sourceAssert} from '../character-prompt-formats/src/storyboard-detail-normalize.js';
import {validateStoryboardRows as sourceValidate} from '../character-prompt-formats/src/storyboard-complete.js';
const assets=path.join(process.env.LOCALAPPDATA,'YingceCanvas/versions/1.3.13/web/dist/assets');
const normalizeSource=fs.readFileSync(path.join(assets,'storyboard-detail-normalize.js'),'utf8');
const bindings=await import(pathToFileURL(path.join(assets,'shot-asset-bindings.js')));
const contracts=await import(pathToFileURL(path.join(assets,'storyboard-detail-contract.js')));
const spatial=await import(pathToFileURL(path.join(assets,'storyboard-spatial-render.js')));
const body=normalizeSource.replace(/^import[^\n]*\n/gm,'').replaceAll('export function ','function ');
const actual=new Function('bindPrompt','inferBindings','analyzeBindings','completePrompt','mainPrompt','auditDetailed','materializeSpatialDiagrams',body+';return {normalizeDetailedRows,assertDetailedRows};')(bindings.bindPrompt,bindings.inferBindings,bindings.analyzeBindings,contracts.completePrompt,contracts.mainPrompt,contracts.auditDetailed,spatial.materializeSpatialDiagrams);
const simple=[{id:'a',title:'王医生',category:'character',primaryVersionId:'va',definition:{aliases:['医生']}},{id:'b',title:'李医生',category:'character',primaryVersionId:'vb',definition:{aliases:['医生']}}];
const sample={plotDescription:'医生走进房间。',videoMotionPrompt:'医生走进房间。',characters:[],assetBindings:[]};
function attempt(fn){try{const result=fn();return{accepted:true,bindingIds:result.flatMap(r=>(r.assetBindings||[]).map(b=>b.nodeId))}}catch(e){return{accepted:false,error:e.message}}}
const chapters=fs.readFileSync(path.join(assets,'chapters-CeKTBaiU.js'),'utf8'),start=chapters.indexOf('on=async(t,n)=>'),end=chapters.indexOf(',sn=async()=>',start),callback=chapters.slice(start+3,end);
const dir=new URL('../character-prompt-formats/build/storyboard-detail-v12/',import.meta.url),read=n=>JSON.parse(fs.readFileSync(new URL(n,dir),'utf8'));
const catalog=read('catalog.json').map(a=>({...a,primaryVersionId:a.primary_version_id})),unit={id:'unit',sourceText:fs.readFileSync(new URL('narration.txt',dir),'utf8')};
const completeSource=fs.readFileSync(path.join(assets,'storyboard-complete.js'),'utf8');
const validateBlock=completeSource.slice(completeSource.indexOf('export function validateStoryboardRows'),completeSource.indexOf('export function catalogRules')).replace('export function ','function ');
const actualValidate=new Function('normalizeDetailedRows','assertDetailedRows',validateBlock+';return validateStoryboardRows;')(actual.normalizeDetailedRows,actual.assertDetailedRows);
async function replay(validator){let writes=0;const commit=new Function('e','RFPrepareRows','nn','RFValidateStoryboardRows','RFReferenceCatalog','Ln','yt','RFRepair','u','$t','return '+callback)({project:{id:'project'},units:[unit],shots:[]},x=>x,x=>x,validator,()=>catalog,x=>x,async()=>writes++,async()=>{}, {invalidateQueries:async()=>{}},()=>{});try{await commit('unit',read('gemini-rich-2.storyboard.json').rows);return{accepted:true,writes}}catch(e){return{accepted:false,writes,error:e.message}}}
const report={time:new Date().toISOString(),installedCallback:chapters.slice(start,end),installedSimple:attempt(()=>actual.normalizeDetailedRows([sample],simple)),sourceSimple:attempt(()=>sourceNormalize([sample],simple)),installedCallbackInstalledValidator:await replay(actualValidate),installedCallbackSourceValidator:await replay(sourceValidate),hashes:['storyboard-complete.js','storyboard-detail-normalize.js','shot-asset-bindings.js'].map(name=>({name,installed:crypto.createHash('sha256').update(fs.readFileSync(path.join(assets,name))).digest('hex'),source:crypto.createHash('sha256').update(fs.readFileSync(new URL('../character-prompt-formats/src/'+name,import.meta.url))).digest('hex')}))};
fs.writeFileSync(new URL('./F12-实际安装路径复核.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
