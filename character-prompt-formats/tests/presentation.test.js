import test from 'node:test';
import assert from 'node:assert/strict';
import {bindPrompt} from '../src/shot-asset-bindings.js';
const assets=[{id:'group',title:'天津学生代表',category:'character'},{id:'flag',title:'请愿抗议旗帜',category:'prop'},{id:'place',title:'街头',category:'environment'}];
test('named declarations, group references in spatial plan and per-Seq shot timing',()=>{
 const input='【0-3秒】\n[数千学生人潮矩阵·黑色学生装]\n机位与运镜/轴线/构图：中景\n【3-6秒】：\n标语旗帜随风摆动';
 const output=bindPrompt(input,assets);
 assert.ok(output.includes('(@[asset:group] 是天津学生代表)'));
 assert.ok(output.includes('本Seq场景为(@[asset:place] 是街头)'));
 assert.match(output,/\[@\[asset:group\]\s*·黑色学生装\]/);
 assert.ok(output.includes('镜头1（预估本镜：3.0秒 ｜ 本Seq累加: 约3.0秒）：'));
 assert.ok(output.includes('镜头2（预估本镜：3.0秒 ｜ 本Seq累加: 约6.0秒）：'));
 assert.ok(output.includes('🎥 机位与构图：'));
 assert.equal(bindPrompt(output,assets),output);
});
test('repeated pure-copy Seq starts numbering from one again',()=>{
 const out=bindPrompt('【0-4秒】\n正文\n【4-8秒】\n正文\n【0-4秒】\n正文',assets);
 assert.equal((out.match(/镜头1（/g)||[]).length,2);
});
test('assets without available reference stay as names, not raw IDs',()=>{
 const refs=[{id:'unready',title:'路人甲',category:'character',mentionable:false}];
 const out=bindPrompt('(@[asset:unready] 是路人甲)\n路人甲站在门口',refs);
 assert.ok(out.includes('路人甲'));assert.ok(!out.includes('@[asset:'));
 assert.equal(bindPrompt(out,refs),out);
});
