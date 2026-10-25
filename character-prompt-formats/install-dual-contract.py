from _audit_install_guard import guard_legacy_install
guard_legacy_install(__file__, allow_build_only=False)
import pathlib,os,datetime,shutil,subprocess
r=pathlib.Path('character-prompt-formats');a=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/versions/1.3.13/web/dist/assets';b=r/'backups'/('dual-contract-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'));b.mkdir(parents=True)
p=r/'src/character-prompt-formats.js';s=p.read_text(encoding='utf8');shutil.copy2(p,b/p.name)
s=s.replace("format.id==='four-panel'?FOUR_PANEL_TRANSPORT_RULES:''", "['four-panel','side-portrait'].includes(format.id)?FOUR_PANEL_TRANSPORT_RULES.replaceAll('四联','所选版式'):''")
s=s.replace("if(format?.id!=='four-panel'||typeof prompt", "if(!['four-panel','side-portrait'].includes(format?.id)||typeof prompt")
s=s.replace("四联模板缺少摄影排版原文", "所选模板缺少摄影排版原文").replace("四联模板缺少负面排障原文", "所选模板缺少负面排障原文")
# An explicit syntactically correct envelope shared by all three templates.
s=s.replace("return content+(format.id", "return content+(format.id")
needle="return content+(['four-panel','side-portrait'].includes(format.id)?FOUR_PANEL_TRANSPORT_RULES.replaceAll('四联','所选版式'):'')+`"
assert needle in s
s=s.replace(needle,"return content+(['four-panel','side-portrait'].includes(format.id)?FOUR_PANEL_TRANSPORT_RULES.replaceAll('四联','所选版式'):'')+JSON_ENVELOPE_RULES+`")
s+='''
export const JSON_ENVELOPE_RULES='\\n\\n【JSON序列化合同】顶层结构示例（字段值需根据正文填写，禁止照抄示例）：'+JSON.stringify({characters:[{name:'角色名称',aliases:[],role:'身份定位',appearance:'外观',physique:'体态',clothing:'服装',personality:'性格',props:'携带物',consistencyPrompt:'稳定形象',multiViewPrompt:'[0.画面要求]项目画风\\n[1.基础档案]实际设定',voiceLanguage:'语言建议',voiceAge:'年龄建议',voiceTimbre:'音色建议'}],scenes:[{name:'场景名称',description:'场景说明',prompt:'完整场景提示词'}],props:[{name:'道具名称',description:'道具说明',prompt:'完整道具提示词'}]})+'。characters/scenes/props始终为数组；aliases为字符串数组，其余资产字段为字符串，禁止改成对象或数组。无资产才返回空数组。只输出完整JSON；不增加外层data/result包装，不要截掉任何引号、逗号或闭合括号。';
'''
p.write_text(s,encoding='utf8');shutil.copy2(p,a/p.name)
p=r/'src/extraction-recovery.js';shutil.copy2(p,b/p.name)
s=p.read_text(encoding='utf8')+'''
export function parseExtractionJSON(raw){
 const text=raw.trim().replace(/^```(?:json)?\\s*/i,'').replace(/\\s*```$/,'');
 let data;
 try{data=JSON.parse(text);}catch(error){
  if(unfinishedJSON(text))throw Error(`模型响应被截断：已收到${text.length}字符，JSON字符串或括号未闭合，资产未保存。`);
  throw Error(`JSON语法错误：${error.message}`);
 }
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('JSON顶层必须为对象');
 for(const key of ['characters','scenes','props'])if(!Array.isArray(data[key]))throw Error(`JSON字段${key}必须为数组`);
 return data;
}
'''
p.write_text(s,encoding='utf8');shutil.copy2(p,a/p.name)
p=a/'chapters-CeKTBaiU.js';s=p.read_text(encoding='utf8');shutil.copy2(p,b/p.name)
old='import{completeExtraction as RFCompleteExtraction}from"./extraction-recovery.js";'
assert old in s;s=s.replace(old,'import{completeExtraction as RFCompleteExtraction,parseExtractionJSON as RFParseExtractionJSON}from"./extraction-recovery.js";')
old='function mn(e){let t=tt(e.trim().replace(/^```(?:json)?\\s*/i,``).replace(/\\s*```$/i,``),!0);'
assert old in s;s=s.replace(old,'function mn(e){let t=RFParseExtractionJSON(e);')
p.write_text(s,encoding='utf8');subprocess.run(['node','--check',str(p)],check=True)
print('Dual and four-panel transport unified; strict whole-document parser installed; original data untouched.')
