import fs from 'node:fs';
import {sourceCoverage,assertSourceCoverage,assertFormatCompleteness} from '../character-prompt-formats/src/extraction-completeness-v4.js';
import {inferBindings,bindPrompt,referenceCatalog} from '../character-prompt-formats/src/shot-asset-bindings.js';
import {loadManagedFormats,expandFourPanelPrompt} from '../character-prompt-formats/src/character-prompt-formats.js';
const results=[];
function probe(id,description,fn){try{results.push({id,description,...fn()})}catch(e){results.push({id,description,error:e.message})}}
probe('A01','普通小说无标签时覆盖清单为空',()=>({input:'张三拿起钥匙，和李四走进仓库。',actual:sourceCoverage({'章节正文':'张三拿起钥匙，和李四走进仓库。'})}));
probe('A02','人物标签以无开头误过滤',()=>({actual:sourceCoverage({'章节正文':'人物：无尘、无忌、无名\n场景：无忧宫'})}));
probe('A03','群众规范化为空可被任意角色满足',()=>{assertSourceCoverage({characters:[{name:'张三',aliases:[]}],scenes:[]},{'章节正文':'人物：群众'});return{actual:'错误接受缺失群众资产'}});
probe('A04','格式仅有空标题也通过',()=>{assertFormatCompleteness({characters:[{name:'张三',multiViewPrompt:Array.from({length:22},(_,i)=>`[${i}.]`).join('\n')}]},{id:'four-panel'});return{actual:'22个空标题被接受'}});
probe('A05','负面句子仍绑定角色',()=>({actual:inferBindings({}, {videoPrompt:'画面只有李四，张三不出场。'},[{id:'a',title:'张三',category:'character',primaryVersionId:'v'}]).map(a=>a.title)}));
probe('A06','绑引用时删除正常场景叙述',()=>({input:'场景是废弃医院，地板有血迹。\n张三缓慢推门。',actual:bindPrompt('场景是废弃医院，地板有血迹。\n张三缓慢推门。',[{id:'a',title:'张三',category:'character',primaryVersionId:'v'}])}));
probe('A07','共享别名的两个角色只能保留输入顺序中的一个',()=>({actual:inferBindings({}, {videoPrompt:'医生走进房间。'},[{id:'a',title:'王医生',category:'character',primaryVersionId:'v1',definition:{aliases:['医生']}},{id:'b',title:'李医生',category:'character',primaryVersionId:'v2',definition:{aliases:['医生']}}]).map(a=>a.title)}));
probe('A08','不同章节同名待确认候选先去重',()=>({actual:referenceCatalog({assets:[],assetCandidates:[{id:'1',name:'张三',category:'character',unitId:'old',status:'pending_confirmation'},{id:'2',name:'张三',category:'character',unitId:'new',status:'pending_confirmation'}]}).map(a=>({id:a.id,unitId:a.unitId}))}));
probe('A09','后台重复格式锚点取第一次导致规则污染',()=>({actual:expandFourPanelPrompt('[0.画面要求]test',{id:'four-panel',content:'说明示例[22.摄影排版指令]：错误例子\n[23.负面排障指令]：说明\n实际版式[22.摄影排版指令]：正确版式\n[23.负面排障指令]：正确\n【输出数据合同】'})}));
const catalog=JSON.parse(fs.readFileSync(new URL('./deep-inventory.json',import.meta.url),'utf8')).templates;
try{const mapped=await loadManagedFormats(()=>catalog);results.push({id:'A10',description:'真实数据库模板解析',actual:mapped.map(f=>({id:f.id,name:f.name,version:f.version,chars:f.content.length}))})}catch(e){results.push({id:'A10',error:e.message})}
fs.writeFileSync(new URL('./probe-results.json',import.meta.url),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
