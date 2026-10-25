import{n as e}from"./rolldown-runtime-DAXXjFlN.js";
function t(e){return`使用当前启用的${e}模板。`}var n,r=e((()=>{n={ChapterAssetsExtract:`chapter_assets_extract`,CharacterExtract:`character_extract`,CharacterTurnaround:`character_turnaround`,StoryboardPlan:`storyboard_plan`,StoryboardRepair:`storyboard_repair`,StoryboardFirstFrame:`storyboard_first_frame`,StoryboardVideo:`storyboard_video`,ShortDramaOutline:`short_drama_outline`,SkillDraft:`skill_draft`}}));
function i(e,t){return`请根据要求修改以下文本。\n\n原文：\n${e}\n\n修改要求：\n${t}`}function a(e,t,n){return e===`compare_versions`?`请对以下视频结果版本做对比分析，输出推荐版本、差异点和修改建议：\n${t}`:`视频编辑任务：${n}\n创作要求：${t}`}function o(){return`你是一个视频字幕关键词高亮助手。请输出严格 JSON。

任务目标：
- 为每条字幕判断是否需要高亮
- 每条字幕最多高亮 1 段
- 只返回最值得高亮的一个关键词或短语
- start 和 end 使用 JavaScript 字符串下标
- end 为 exclusive
- 没有明确重点时返回 shouldHighlight=false

高亮标准：
- 优先高亮结论词、数字、身份词、首次/突破词、强反差词
- 不要高亮虚词、口头语、整句长短语

边界约束：
- 不负责颜色、字号、位置、动效
- 只返回 highlights 数组
- highlightText 必须严格等于原字幕文本切片结果`}function s(e){return`请根据以下字幕和上下文，为每条字幕判断是否需要高亮，并返回 JSON：

{
  "highlights": [
    {
      "entryIndex": 1,
      "shouldHighlight": true,
      "highlightText": "示例",
      "start": 0,
      "end": 2
    }
  ]
}

字幕列表：
${e.map(e=>`entryIndex=${e.index} | startMs=${e.startMs} | endMs=${e.endMs} | text=${e.text}`).join(`
`)}`}var c,l,u=e((()=>{c=[{id:`character-sheet`,name:`角色设定图`,description:`正面、侧面、背面与表情参考，锁定角色一致性`,prompt:`生成角色设定图：保持同一角色身份、五官、发型、服装和体态一致，包含正面、侧面、背面和关键表情参考，背景简洁，便于后续镜头复用。`,modes:[`image`],source:`builtin`},{id:`multi-angle`,name:`多机位视角`,description:`围绕同一主体生成连续、可衔接的机位变化`,prompt:`围绕同一主体设计多机位画面，保持人物、服装、场景和光线一致，分别给出远景、全景、中景、近景、特写、侧面、背面和俯拍视角，镜头之间具有连续性。`,modes:[`image`,`video`],source:`builtin`},{id:`next-shot`,name:`画面推演`,description:`推演当前画面的前后动作与镜头衔接`,prompt:`基于当前画面推演下一个连续镜头：保持角色和场景一致，明确主体接下来的动作、视线、环境变化、镜头运动和自然衔接方式，不要跳变构图或身份。`,modes:[`image`,`video`],source:`builtin`},{id:`story-beats`,name:`连续镜头`,description:`将短剧情拆成可生成的连续镜头节拍`,prompt:`把这段内容拆成连续镜头节拍。每个镜头写清主体动作、景别、构图、机位、运镜、光线、情绪和与前后镜头的衔接，并保持角色、场景和道具一致。`,modes:[`text`,`image`,`video`],source:`builtin`},{id:`cinematic-light`,name:`电影光影优化`,description:`保留内容，优化真实光线、层次和融合感`,prompt:`保留主体身份、动作和原始构图，优化为真实电影摄影光线：明确主光方向、环境反射、阴影层次、肤色和背景融合，降低塑料感与过度锐化，不改变画面内容。`,modes:[`image`,`video`],source:`builtin`},{id:`video-prompt`,name:`视频提示词优化`,description:`整理为模型更容易执行的时序化镜头指令`,prompt:`将当前要求改写为结构化视频提示词，按时间顺序描述开场画面、主体动作、镜头运动、环境变化、声音和结束画面；消除冲突指令，保留所有关键约束。`,modes:[`text`,`video`],source:`builtin`}],l=`请根据参考图片反推一段适合用于 AI 生图的提示词。

要求：
1. 只输出提示词正文，不要解释。
2. 覆盖主体、构图、风格、光线、色彩、材质、镜头和氛围。
3. 尽量写成可直接用于生图模型的完整提示词。`}));
function d(e){let t=e.replace(/```json/gi,``).replace(/```/g,``).trim().match(/\{[\s\S]*\}/),n=t?JSON.parse(t[0]):{},r=String(n.title||``).trim(),i=String(n.synopsis||``).trim(),a=Array.isArray(n.chapters)?n.chapters.map(e=>{let t=typeof e==`object`&&e?e:{};
return{title:String(t.title||``).trim(),content:String(t.content||``).trim()}}).filter(e=>e.title&&e.content):[];
return{title:r||f(e),synopsis:i,chapters:a}}function f(e){let t=e.split(/\r?\n/).find(e=>e.trim());
return t?t.trim().slice(0,24):`AI 生成短剧`}function p(e){return{用户故事:e.story,章节数量:e.chapterCount,叙事结构:e.structure,每章字数:e.wordCount,叙事视角:e.perspective,整体基调:e.tone,角色规模:e.characterScale,章节篇幅:e.chapterLength}}var m=e((()=>{})),h=e((()=>{r(),u(),m()}));
export{c as a,s as c,u as d,n as f,p as i,i as l,t as m,m as n,l as o,r as p,d as r,o as s,h as t,a as u};
