import pathlib, os, shutil
root = pathlib.Path(__file__).parent
p = root/'build/chapters-CeKTBaiU.js'
s = (root/'backups/chapters-before-dialog-actions.js').read_text(encoding='utf-8')
def replace(a,b):
    global s
    assert a in s, a[:100]
    s=s.replace(a,b)
replace(r'\n改编强度：${pe}/5','')
replace('j.current&&A.current&&','(j.current||xe)&&A.current&&')
replace('await Fe(),C(!1),i()','await Fe(),i()')
replace('【对话工作流】原文','【连续性】参考前后章节衔接，明确环境、光源方向、人物站位与动作承接。未知信息标为待确认。开头列出用户建议和本轮改动，不重复标注改编强度。【对话工作流】原文')
replace('S.filter(e=>e!==o.id)','[...new Set([...S,...c.slice(Math.max(0,c.findIndex(e=>e.id===o.id)-1),c.findIndex(e=>e.id===o.id)+2).map(e=>e.id)])].filter(e=>e!==o.id)')
replace(r'children:e.replace(/^\s*(用户：|AI：)\s*/,``)',r'''children:[e.replace(/^\s*(用户：|AI：)\s*/,``).replace(/\n改编强度：[1-5]\/5/g,``),!n?(0,q.jsxs)(`div`,{className:`mt-3 flex flex-wrap gap-2 border-t border-border pt-2`,children:[(0,q.jsx)(f,{size:`small`,onClick:async()=>{try{await navigator.clipboard.writeText(e.replace(/^\s*AI：\s*/,``));ie.success(`已复制`)}catch{ie.error(`复制失败`)}},children:`复制`}),(0,q.jsx)(f,{size:`small`,disabled:F,onClick:()=>void Ie(!0,`确认以下方案，生成完整剧本：\n${e}`),children:`确认方案`}),(0,q.jsx)(f,{size:`small`,disabled:F,onClick:async()=>{try{await bt(l,o.id,{screenplayText:e.replace(/^\s*AI：\s*/,``),expectedScreenplayText:_});await Fe();i();ie.success(`已导出到该章节`)}catch(t){ie.error(t.message||`导出失败`)}},children:`导出到该章节`})]}):null]''')
p.write_text(s,encoding='utf-8')
target=pathlib.Path(os.environ['LOCALAPPDATA'])/'YingceCanvas/versions/1.3.13/web/dist/assets'/p.name
shutil.copy2(p,target)
assert target.read_text(encoding='utf-8')==s
print('Installed UTF-8 patch; actions:',s.count('导出到该章节'))
