import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {auditDetailed,completePrompt,copyFromMain,mainPrompt}from '../src/storyboard-detail-contract.js';
test('previously accepted real Gemini result fails the stronger content audit',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../build/storyboard-test/gemini-format-2.storyboard.json',import.meta.url),'utf8'));
 assert.ok(auditDetailed(data.rows[0]).some(s=>/俯视图|九宫格/.test(s)));
 assert.ok(auditDetailed(data.rows[0],{requireCopy:true}).some(s=>/纯享版/.test(s)));
});
test('copy version preserves all real prose, narration, references and time labels without an AI summary',()=>{
 const main='(@[asset:student] 是天津学生代表)；本Seq场景为@天津街头。\n【场景九宫格】：左前：民国建筑，中心：@天津学生代表。\n镜头1（预估本镜：3.0秒 ｜ 本Seq累加: 约3.0秒）：\n【全息周边环境、光源投影、坐标体态锁、180度轴线站位与机位俯视图】：\n┌────┐\n│ @天津学生代表 ↑ 🎥 │\n└────┘\n🎥 机位与构图：大远景，缓慢推镜。\n台词及固定音色/呼吸留白：旁白（画外音）：声援北京学生运动。\n【段尾音频DNA与系统状态锁】：寒风延续。';
 const output=completePrompt(main);assert.equal(mainPrompt(output),main);assert.equal(completePrompt(output),output);
 const copy=copyFromMain(main);for(const token of ['@[asset:student]','场景九宫格','镜头1','声援北京学生运动。','寒风延续。'])assert.ok(copy.includes(token));assert.ok(!copy.includes('┌'));assert.ok(!copy.includes('全息周边环境'));
});
