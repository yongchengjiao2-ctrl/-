import fs from 'node:fs';
import {validateStoryboardRows,completeConfig} from '../character-prompt-formats/src/storyboard-complete.js';
import {copyFromMain} from '../character-prompt-formats/src/storyboard-detail-contract.js';
const dir=new URL('../character-prompt-formats/build/storyboard-detail-v12/',import.meta.url);
const read=n=>JSON.parse(fs.readFileSync(new URL(n,dir),'utf8'));
const catalog=read('catalog.json').map(a=>({...a,primaryVersionId:a.primary_version_id}));
const fixture=read('gemini-rich-2.storyboard.json').rows;
const results=[];
for(const [id,source,mutate] of [
 ['B01','场次：室内\n△画面：甲站着。\n甲：这句对白必须保留。',r=>r],
 ['B02','场次：室内\n△画面：甲站着。\n△画面：乙从窗户跳出。',r=>r.map(x=>({...x,sourceBeats:[]}))],
]){
 try{const out=validateStoryboardRows(mutate(structuredClone(fixture)),catalog,source);results.push({id,accepted:true,rows:out.length,input:source,sourceBeats:out.map(r=>r.sourceBeats),dialogueIncludesExpected:out.some(r=>r.dialogue?.includes('这句对白必须保留'))})}catch(e){results.push({id,accepted:false,error:e.message})}
}
results.push({id:'B03',input:'🎥 机位：向前│看齐\n旁白：A─B街区。',actual:copyFromMain('🎥 机位：向前│看齐\n旁白：A─B街区。')});
results.push({id:'B04',actual:completeConfig({model:'a::gemini',channels:[{id:'a',models:['gemini'],interfaceType:'gemini-generate-content',modelCosts:[{model:'gemini',protocol:'gemini-generate-content',defaultOptions:{temperature:0.3}}]}]}).channels[0]});
fs.writeFileSync(new URL('./storyboard-probe-results.json',import.meta.url),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
