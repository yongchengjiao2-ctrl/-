import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {parsePlannedText,planScript,packedV2PlanScript,renderPlanned} from '../character-prompt-formats/src/storyboard-planned.js';
import {auditDetailed} from '../character-prompt-formats/src/storyboard-detail-contract.js';
import {assertSourceFidelity} from '../character-prompt-formats/src/source-script-contract.js';
const out=new URL('./',import.meta.url),src=new URL('../character-prompt-formats/src/',import.meta.url),dir=new URL('../character-prompt-formats/build/test-six/',import.meta.url);
const installed=path.join(process.env.LOCALAPPDATA,'YingceCanvas/versions/1.3.13/web/dist/assets'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const report={newModelCalls:0,productionWrites:false,hashes:[],replays:[],parserProbes:[]};
for(const name of ['storyboard-planned.js','storyboard-planned-runtime.js','source-script-contract.js','storyboard-complete.js','text-request-policy.js']){const a=fs.readFileSync(new URL(name,src)),b=fs.readFileSync(path.join(installed,name));report.hashes.push({name,sourceHash:hash(a),installedHash:hash(b),same:a.equals(b)});}
const input=JSON.parse(fs.readFileSync(new URL('input.json',dir),'utf8'));
for(const name of fs.readdirSync(dir).filter(n=>/chapter-\d-(?:directed-.*|packed-v2)\.model\.json$/.test(n))){
 const chapter=Number(/chapter-(\d)/.exec(name)[1]),source=input.units[chapter-1].source_text,plan=name.includes('packed-v2')?packedV2PlanScript(source):planScript(source),item={name,planVersion:plan.version||2};
 try{const raw=parsePlannedText(fs.readFileSync(new URL(name,dir),'utf8')),result=renderPlanned(raw,plan);assertSourceFidelity(result.rows,source);item.rows=result.rows.length;item.errors=result.rows.flatMap((r,i)=>auditDetailed(r,{requireCopy:true}).map(e=>`row ${i+1}: ${e}`));item.accepted=!item.errors.length;}catch(e){item.accepted=false;item.error=e.message;}
 report.replays.push(item);
}
for(const [name,text] of [['missing-property-quote','{\n camera": {"position":"原始人物不变"}\n}'],['truncated','{"segments":[{"id":1'],['quoted-comma','{"x":"人物说逗号,而不是结束"}']]){try{report.parserProbes.push({name,accepted:true,result:parsePlannedText(text)})}catch(e){report.parserProbes.push({name,accepted:false,error:e.message})}}
fs.writeFileSync(new URL('source-review-latest.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
