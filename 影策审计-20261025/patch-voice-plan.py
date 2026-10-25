from pathlib import Path
p=Path(__file__).parent.parent/'character-prompt-formats/src/storyboard-planned.js'
s=p.read_text('utf8')
old='voice:t.voice,sourceBeat:t.part?.beat,'
new="voice:t.voice,...contentContract>=5?{voiceHint:t.part?.voiceHint||'',voiceSource:t.part?.voiceSource||'unknown'}:{},sourceBeat:t.part?.beat,"
assert s.count(old)==1
p.write_text(s.replace(old,new),'utf8')
