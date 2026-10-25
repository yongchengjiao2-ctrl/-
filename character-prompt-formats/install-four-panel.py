from _audit_install_guard import guard_legacy_install
guard_legacy_install(__file__, allow_build_only=False)
import pathlib,datetime,os,shutil
root=pathlib.Path('character-prompt-formats');p=root/'src/character-prompt-formats.js';s=p.read_text(encoding='utf8');backup=root/'backups'/('four-panel-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'));backup.mkdir(parents=True);shutil.copy2(p,backup/p.name)
s=s.replace('return content+`\\n\\n【输入数据】', 'return content+(format.id===\'four-panel\'?FOUR_PANEL_TRANSPORT_RULES:\'\')+`\\n\\n【输入数据】')
old="return {...base,characters:base.characters.map(character=>({...character,characterPromptFormat:{id:format.id,name:format.name,version:format.version,template:format.content}}))};"
new="return {...base,characters:base.characters.map(character=>({...character,multiViewPrompt:expandFourPanelPrompt(character.multiViewPrompt,format),characterPromptFormat:{id:format.id,name:format.name,version:format.version,template:format.content}}))};"
assert old in s;s=s.replace(old,new)
s+='''
// Fixed layout is deterministic and need not consume model output for every role.
export const FOUR_PANEL_TRANSPORT_RULES=`\\n\\n【四联JSON传输规则，优先于上面的重复排版要求】\\n输出字段和顶层characters/scenes/props合同不变，仍只输出一个完整JSON。人物各字段用紧凑而完整的中文，避免appearance、clothing、consistencyPrompt和multiViewPrompt大段逐字重复。multiViewPrompt必须包含该角色独有的[0.画面要求]与[1.基础档案]至[21.鞋靴]，各项保留具体设定，建议每项一至两句；不得省略角色或群像以缩短篇幅。multiViewPrompt暂不重复[22.摄影排版指令]、[23.负面排障指令]、[24.背景与渲染]的固定内容，这三节由应用按本次所选模板原文补全后保存。人物的role、三个voice字段及其他必需字段必须齐全。场景和道具规则不变。JSON字符串中的换行必须转义为\\\\n，双引号必须转义，禁止字符串内直接换行。先完成全部资产和JSON闭合，不输出解释或Markdown。`;
export function expandFourPanelPrompt(prompt,format){
 if(format?.id!=='four-panel'||typeof prompt!=='string'||!prompt.trim())return prompt;
 const content=format.content||'';
 const start=content.indexOf('[22.摄影排版指令]：');
 const stop=content.indexOf('【输出数据合同】',start);
 if(start<0)throw Error('四联模板缺少摄影排版原文，请恢复内置格式后重试');
 let fixed=content.slice(start,stop<0?undefined:stop).trim();
 if(!fixed.includes('[23.负面排障指令]'))throw Error('四联模板缺少负面排障原文');
 if(!fixed.includes('[24.背景与渲染]'))fixed+='\\n[24.背景与渲染]：纯白背景，继承本角色[0.画面要求]中的项目画风、材质和时代；清晰完整，无水印。';
 const existing=prompt.indexOf('[22.摄影排版指令]');
 return (existing<0?prompt:prompt.slice(0,existing)).trim()+'\\n'+fixed;
}
'''
p.write_text(s,encoding='utf8');a=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/versions/1.3.13/web/dist/assets';shutil.copy2(p,a/p.name)
print('Installed compact four-panel transport with deterministic full-layout expansion')
