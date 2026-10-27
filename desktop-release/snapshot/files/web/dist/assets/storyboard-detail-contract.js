export const COPY_HEADING='【一键复制AI视频纯享提示词（纯净高权重安全版）】';
export const DETAIL_RULES=`
【完整分镜正文合同 v1.2】
本次videoMotionPrompt必须输出完整中文导演主稿，不能把标题当成已经完成内容。主稿必须达到下列深度，不输出英文摘要。纯享复制版由宿主从主稿无损复制（仅去掉俯视图），本次模型不必重复输出复制版，节省重复Token；这不是省略主稿任何栏目。
配音按人物实际语气与情绪自然安排，每秒最多7个非空白字符，不强制4字/秒，不把人物对白统一变成旁白。durationSeconds不足时由导演延长或拆段，不删词、不超速，按需保留停顿。段内镜头数量及切点由导演决定，不机械套固定数量。
开头逐一介绍本段所有可见人物、场景和道具的真实@引用。不能出现“( 是人物)”、空白坐标、只写旗帜而漏掉本段已知的具体旗帜。
开头直接写“(@引用 是实际名称)；本Seq场景为@实际场景”。不要照抄“素材介绍（本段可见人物/道具）”等模板占位文字。@[asset:...]括号里只能用目录给出的真实ID，中文场景名只能写@场景名，禁止写@[asset:中文名称]。
以下每栏都必须有具体内容：
【角色固定音色锁】：发声者、画外音/对白、音色、情绪、语速、口型处理。
【关键点前缀】：年代、项目画风、冷暖色调、光线与材质。
【全局执行规则】：本段人物服饰、群像、道具及时代连续性。
【画面约束（按需靶向约束）】：针对本段实际风险。
【特殊触发状态】：有则写具体状态，没有写“无额外触发状态”。
【上段继承状态锁】：初始/继承的坐标、朝向、持物手、姿态、光源及动作。
【场景、空间站位、体态死锁与按需激活模块总设计】：用@引用说明前后景、横纵轴、人物位置、姿态、朝向、持物左右手及摄影机方向；历史意象无人物时明确写无人物，不编造人物。
【场景九宫格】：逐项填写左前、正前、右前、左中、中心、右中、左后、正后、右后共9格。画面外或被遮挡的格子也明确说明，不能用一句话代替九宫格。
【BGM与跨Seq音频DNA无缝锁总设计】：逐项填写“BGM：”“BPM：”“环境底噪：”“对白闪避：”“首尾衔接：”。无BGM也明确写无与BPM不适用。
每个内部镜头必须具备：
镜头N（预估本镜：X.X秒 ｜ 本Seq累加: 约Y.Y秒）：
【全息周边环境、光源投影、坐标体态锁、180度轴线站位与机位俯视图】：真正画出多行┌─┐、│ │、└─┘的俯视框线图，标注🎥机位及方向箭头↑↓←→、本镜可见人物/道具/场景@引用、轴线与光源方向。不要用“高空俯视”一句话代替图。图中不能用空白代替人物引用。
【分镜详情】：
🎥 机位与构图：景别、主运镜、焦点、轴线及起止位置，详细写可见构图。
💡 光影与环境：光源方向、投影、天气/风、色调与材质反馈。
🎭 表演与防穿帮：动作起止、位置、视线、姿态、左右手、持物、服装；无人物则详细写环境变化。
台词及固定音色/呼吸留白：旁白（画外音）：原文片段。无配音则写“无配音，保留环境声”。本段所有内部镜头台词拼接须逐字等于本行dialogue，不能漏句或重复。不得新增台词、口号或人物说话。
🔊 声效：具体同步音效及落点。
【段尾视觉、坐标体态、轴线与状态锁】：结束坐标、朝向、持物手、姿态、光源与下段衔接。
【段尾音频DNA与系统状态锁】：旁白是否结束、底噪/BGM及下段承接。
每段持续时间1至15秒；根据原文与自然动作自行决定分段和内部镜头数。不要压缩配音硬塞时长。原文中每一条△画面均须覆盖，在rows每行额外填写sourceBeats（本行覆盖的原画面序号整数数组），同一原画面可跨段，不可漏画面。JSON必须一次完整返回。
`;
const heading=/【一键复制AI视频[^】]*】[：:]?/;
export function mainPrompt(text){return String(text||'').split(heading)[0].trim();}
export function copyFromMain(text){
 const lines=mainPrompt(text).split('\n'),copy=[];
 for(let i=0;i<lines.length;i++){
  // Only remove a complete box block. A dash or vertical bar in dialogue is
  // ordinary source text and must never delete the surrounding sentence.
  if(/^\s*┌[─━┬]+┐\s*$/.test(lines[i])){
   let end=i+1;
   while(end<lines.length&&/^\s*[│├┼]/.test(lines[end]))end++;
   if(end<lines.length&&/^\s*└[─━┴]+┘\s*$/.test(lines[end])){i=end;continue;}
  }
  const line=lines[i].replace(/^\s*【全息周边环境[^】]*】[：:]?\s*/, '');
  copy.push(line);
 }
 return copy.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
export function completePrompt(text){const main=mainPrompt(text);return main+'\n\n'+COPY_HEADING+'：\n\n'+copyFromMain(main);}
const globalHeaders=['角色固定音色锁','关键点前缀','全局执行规则','画面约束','特殊触发状态','上段继承状态锁','场景、空间站位','场景九宫格','BGM与跨Seq','段尾视觉','段尾音频'];
const tagPattern=/镜头\s*(\d+)\s*[（(]预估本镜[：:]\s*(\d+(?:\.\d+)?)秒\s*[｜|]\s*本Seq累加[：:]\s*约?(\d+(?:\.\d+)?)秒[）)]/g;
const clean=s=>String(s||'').replace(/\s/g,'');
export function auditDetailed(row,{requireCopy=false}={}){
 const errors=[],main=mainPrompt(row.videoMotionPrompt),headingMain=main.replace(/【([^】]+)】/g,(_,s)=>'【'+s.replace(/[,，]\s*/g,'、')+'】'),tags=[...main.matchAll(tagPattern)];
 for(const name of globalHeaders){
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),m=new RegExp('【'+escaped+'[^】]*】[：:]?([^]*?)(?=\\n【|\\n镜头\\s*\\d+|$)').exec(headingMain);
  if(!m||clean(m[1]).length<(name==='场景、空间站位'?15:3))errors.push('栏目内容缺失：'+name);
 }
 for(const cell of ['左前','正前','右前','左中','中心','右中','左后','正后','右后'])if(!main.includes(cell))errors.push('九宫格缺少'+cell);
 for(const field of ['BGM','BPM','环境底噪','对白闪避','首尾衔接'])if(!new RegExp(field+'[：:]\\s*[^\\n；;\\s]+','i').test(main))errors.push('音频缺少'+field);
 if(!tags.length)errors.push('内部镜头缺失');
 let spoken='',sum=0;
 for(let i=0;i<tags.length;i++){
  const tag=tags[i],body=main.slice(tag.index+tag[0].length,tags[i+1]?.index??main.search(/【段尾视觉/));
  sum+=Number(tag[2]);if(Number(tag[1])!==i+1||Math.abs(sum-Number(tag[3]))>.15)errors.push('镜头时间累计不一致');
  if(!/┌[^\n]*┐/.test(body)||!body.includes('└')||body.split('\n').filter(x=>x.includes('│')).length<2||!body.includes('🎥')||!/[\u2190-\u21ff<>⊙]|固定/.test(body))errors.push(`镜头${i+1}缺少实际俯视图`);
  for(const [label,re]of [['机位',/🎥\s*机位与构图[：:]([^\n]+)/],['光影',/💡\s*光影与环境[：:]([^\n]+)/],['表演',/🎭\s*表演与防穿帮[：:]([^\n]+)/],['声效',/🔊\s*声效[：:]([^\n]+)/]]){const m=re.exec(body);if(!m||clean(m[1]).length<(label==='声效'?4:8))errors.push(`镜头${i+1}${label}内容不足`);}
  let voices=[...body.matchAll(/(?:台词及固定音色\/呼吸留白|💬\s*台词)[：:]([^\n]*)/g)];if(!voices.length){const v=/💬\s*((?:旁白|对白|OS|OV)[^\n]*)/.exec(body);if(v)voices=[v];}
  if(!voices.length)errors.push(`镜头${i+1}缺少台词/留白`);
  for(const voice of voices)if(!/无配音/.test(voice[1])){const line=voice[1].replace(/^\s*(?:[^：:（(]+[（(](?:画外音|对白|OS|VO|OV)[）)]|(?:旁白|对白|OS|OV)(?:[（(][^）)]*[）)]|，?画外音)?)\s*[：:]\s*/,'').trim();spoken+=line;if(clean(line).length/Number(tag[2])>7.000000001)errors.push(`镜头${i+1}配音超速`);}
 }
 if(Math.abs(sum-Number(row.durationSeconds))>.15)errors.push('内部镜头总时长不匹配');
 if(clean(spoken)!==clean(row.dialogue))errors.push('内部镜头配音与dialogue不一致');
 if(clean(row.dialogue).length/Number(row.durationSeconds)>7.000000001)errors.push('本段配音超速');
 if(/本段可见人物\/道具|实际秒数|同上|略去/.test(main))errors.push('残留模板占位内容');
 if(/\(\s*是|（\s*是|：\s*\n\s*[；;]/.test(main))errors.push('存在空白引用/坐标');
 if(main.includes('未绑定素材'))errors.push('包含无法解析的素材引用');
 if(requireCopy){const copy=String(row.videoMotionPrompt).split(heading)[1]?.replace(/^[：:]?\s*/,'');if(!copy||clean(copy)!==clean(copyFromMain(main)))errors.push('纯享版遗漏或改写主稿内容');}
 return errors;
}
