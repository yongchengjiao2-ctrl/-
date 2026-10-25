// Draw only from spatial information actually present in the model response.
const cells=['左前','正前','右前','左中','中心','右中','左后','正后','右后'];
export function gridCells(text){
 const section=/【场景九宫格】[：:]?([^]*?)(?=\n【|$)/.exec(text)?.[1];if(!section)return null;
 const values=cells.map(name=>{const re=new RegExp(name+'[：:(（]\\s*([^]*?)(?=(?:'+cells.join('|')+')[：:(（]|$)');return re.exec(section)?.[1]?.replace(/[；;、\s]+$/,'').replace(/[)）]\s*$/,'').trim();});
 return values.every(Boolean)?values:null;
}
function framed(lines){const width=Math.max(44,...lines.map(s=>Array.from(s).reduce((n,c)=>n+(/[\u2e80-\uffff]|\p{Extended_Pictographic}/u.test(c)?2:1),0)));return ['┌'+'─'.repeat(width+2)+'┐',...lines.map(s=>'│ '+s+' │'),'└'+'─'.repeat(width+2)+'┘'].join('\n');}
export function materializeSpatialDiagrams(text){
 const values=gridCells(text);if(!values)return text;
 const marker=/镜头\s*\d+\s*[（(]预估本镜[^\n]+/g,tags=[...text.matchAll(marker)];let output=text;
 for(let i=tags.length-1;i>=0;i--){
  const start=tags[i].index+tags[i][0].length,end=tags[i+1]?.index??text.search(/【段尾视觉/);if(end<start)continue;
  const body=text.slice(start,end);if(/┌[^\n]*┐/.test(body)&&body.includes('└')&&body.split('\n').filter(s=>s.includes('│')).length>=2)continue;
  const camera=/🎥\s*机位与构图[：:]([^\n]+)/.exec(body)?.[1]?.trim(),light=/💡\s*光影与环境[：:]([^\n]+)/.exec(body)?.[1]?.trim();if(!camera||!light)continue;
  const lines=['↑=九宫格前排（示意坐标，不表示人物移动）',...values.map((v,j)=>cells[j]+'：'+v),'🎥 本镜机位说明：'+camera,'💡 本镜光源说明：'+light];
  const diagram='\n【全息周边环境、光源投影、坐标体态锁、180度轴线站位与机位俯视图】：\n'+framed(lines)+'\n';
  // Keep original text; insert the generated diagram immediately before details.
  const at=body.indexOf('【分镜详情】');if(at<0)continue;
  output=output.slice(0,start+at)+diagram+output.slice(start+at);
 }
 return output;
}
