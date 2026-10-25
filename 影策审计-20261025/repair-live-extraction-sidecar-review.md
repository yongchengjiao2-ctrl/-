# 逐节来源sidecar保留修复（源码候选）

仅修改源码与离线测试，没有安装、没有写数据库、没有新增供应商请求。

修改前runtime SHA256：`3677ffd5743486e47d7ac0b214e0c726e12d256d006b726b2c68124349ebd665`。

## 最小修改

`extraction-section-provenance.js` 新增 `restoreSectionSidecars(parsed,raw,variables,format)`。保留legacy已校验字段，以NFKC规范化主名称唯一匹配原raw项；不使用aliases或数组顺序。逐节数据存在时，缺正文/模板上下文、重复主名、无法匹配、解析器合并/丢角色、混用未声明逐节结构，均拒绝。

模型自报sectionReview一律丢弃；重新执行validateAndRenderSections检查真实quote/text子串、栏目、建议占位，并由宿主产生可信review与最终multiViewPrompt/visualProvenance。原sectionProvenance结构clone保留，不盲目spread覆盖legacy字段。无逐节结构的旧数据保持legacy字段，但不能携带伪造accepted review。

runtime `validateAssets(text,context={})` 在原parseCharacters+身份恢复后调用helper。当前请求与恢复入口传提交时正文变量/模板上下文。未把v7提示词合同设为生产默认，旧v6/更早数据没有sectionProvenance时不新增逐节要求。

注意：这会让带逐节结构的数据必须重验，不能在没有上下文时只为“保留字段”而信任模型review。候选仍未成功交付，不能因为sidecar修复就宣称v7模型输出可用。

## 验证

新增4项 `audit-section-sidecar-runtime.test.js`：

1. 提取当前runtime真实validateAssets函数体，使用实际安装character-parser-v3.js解析器，证明主名trim后结构保留、模型review被重算、自由multiViewPrompt不被信任、身份字段不丢。
2. 同名重复、主名无匹配、缺上下文拒绝，不按别名/顺序任意绑定。
3. 没有逐节结构的旧数据不能夹带模型自报perfect review。
4. 读取已保存的真实v7 response离线回放，空泛建议被当前helper拒绝；测试没有fetch、没有数据库写入。

连同runtime6项、section纯函数4项，**14/14通过**。日志 `repair-live-extraction-sidecar-tests.txt`；两源码强制ESM语法检查通过。

## compiled mn精确待接线方案（本次未编辑）

当前mn取raw结果为n，再调用 `et(JSON.stringify({characters:n.characters}))`，按legacy字段构造角色数组；这一步仍会再次丢sidecar。根统一接线时：

1. 给mn增加第二参数context，含variables与format，保留现有默认空对象保证旧任务兼容。
2. 在现et角色解析、原raw项字段合并完成后，以 `restoreSectionSidecars(parsedCharacters,n.characters,context.variables,context.format)` 替代直接返回parsedCharacters。角色双联固定排版在之后annotateResult追加即可。
3. yn已拥有本次提交变量和roleFormat，应将**与xn相同的实际变量**传给mn，不重新从UI当前选择取模板或正文。提交变量包含既有素材覆盖说明附加文本，必须与来源校验使用的变量完全一致。
4. 新恢复路径现走RFValidateRecovered，可避免再经mn；若有旧恢复分支回到mn，metadata有对应正文/模板快照时再传context。无上下文且带sectionProvenance必须拒绝，不降级为盲保留。
5. 不要复制模型的sectionReview到已确认资产，不自动改旧项目状态；候选review展示继续requiresHumanReview。

尚需根对compiled实际函数提取执行相同回归与安装清单审查。缺该接线时，源码runtime虽保留sidecar，章节第二解析仍会丢失；不能算全链路闭环。
