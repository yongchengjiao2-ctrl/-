# v6真实提取验收：未通过

2026-10-25，本轮只发送 **1次 Gemini 3.1 Pro Preview 五维请求**，虚构林岚/陈墨/仓库/铜钥匙/木桌短样例。无自动重试，无补模型请求，没有安装或写业务数据库。旧v5证据保持不变；脚本新增 `--v6`，输出独立 `repair-live-extraction-v6-*`。

## 实际链路

- 只读读取当前启用后台三模板，选择五维v1；协议按normalizeTextConfig→textRequestPolicy，保持a6api-chat。
- 请求prompt严格采用当前runtime顺序：身份规则→空身份目录（独立虚构样例）→后台完整提取模板→coverageRules→当前COMPACT_TRANSPORT_RULES→SOURCE_INVENTORY_RULES。
- 使用**当前源码真实validateAssets与validateRecoveredExtraction函数体**，注入实际安装 `character-parser-v3.js` 中的parseCharacters；非手写第二套v6验收。
- 源码runtime SHA256：`19b873851cf1b410ab98c40160e9507e4ab2b36f1542fdafdbcdc863198ed688`。
- 当前五维模板 SHA256：`79c2213e510362c8c00f647366f0ff3ad4cbc7fce74b61a874f2256b49ef414a`。

## 返回与拒绝证据

HTTP200，application/json，finish_reason=stop，耗时5.888秒。供应商usage：输入3508，输出1687，总5195 token。原始正文2527字符。

模型返回2名角色、1个仓库场景、2个道具，**木桌作为独立props存在**。但是：

1. 顶层完全省略 `sourceInventory`。
2. 所有资产完全省略 `visualProvenance`。
3. 实际v6校验抛出 `来源清单合同v6要求顶层sourceInventory数组`；没有产生可保存通过的最终assets文件，最终report `validated=false`。

因此这次只能证明v6对缺合同的真实响应会拒绝，不能证明模型能稳定生成新合同。不能将“请求成功”或“拒绝保护成功”计为整个提取功能完成。

## 人工内容审查

木桌独立提取比上一普通小说样例好，但原文事实与视觉补充边界仍有问题：

- 林岚被写“性格严谨认真”，陈墨写“沉稳负责”，原文只提供职业、服装和交接动作，未明确这些性格事实。
- appearance开头提到造型建议，但multiViewPrompt中的鼻型、眼皮、皮肤、帆布材质、腰带等直接作为确定设定，没有逐项分区或标签。
- appearance的笼统“建议”不能自动视为其它字段都已被准确标注，更不能取代缺失的visualProvenance结构。

## 限制与建议

本次没有桌面任务/计费/候选写入/恢复UI验收；当前根代理的UI工具被工作设置禁用，不能假报完成。没有实际生图，版式最终画面未验证。

不自动重试。本次新合同失败率样本只有1次，不能推断所有模型都失败，但已足以表明v6不能直接以“真实测试通过”交付。根代理可审查是否需将新合同提升为更靠近输出的单一明确JSON schema，减少与旧三数组示例/重复合同竞争；若安排下一次真实验证，应另立前缀并明确调用预算，不能覆盖本次失败。

脚本已有started标记，重复执行 `--v6` 会SKIP本次请求，实测确认未重复发送。
