# 修复后真实提取验证（2026-10-25）

本轮严格发送 **2 次**供应商请求：Gemini五维1次、DeepSeek双联1次，没有自动重试、没有额外模型补请求。只使用林岚、陈墨、仓库、铜钥匙、木桌的虚构输入。密钥只从既有本地配置快照读取到内存，没有输出/写入证据。

使用当前数据库启用的三模板建立快照，实际选用五维和双联；模板正文及SHA256在 `repair-live-extraction-templates.json`。读库采用SQLite只读连接，没有创建任务、写候选或改生产项目。

## 结果

| 测试 | 实际响应 | 程序合同 | 人工内容验收 | 结论 |
|---|---|---|---|---|
| Gemini 3.1 Pro Preview，五维，带标签剧本 | HTTP200，6.502秒；2角色、1场景、2道具；usage输入3095、输出1891、合计4986 | JSON、非空字段、身份字段、实际安装parseCharacters、五维固定排版追加、显式标签匹配通过；coverage为labeled-partial | 未通过严格事实/建议层级：原文未明确鼻型、发型、棉质夹克等直接写作设定，未标“造型建议”，并与appearance“正文未明确”不一致 | 结构路径通过，语义验收仍需修复；不记整项成功 |
| DeepSeek v4 Pro 0813，双联，无标签普通小说 | HTTP200，60.232秒；2角色、1场景、1道具；usage输入4047、输出9976、合计14023，报告reasoning6447 | JSON、非空字段、身份字段、安装parser、双联0—21节与固定22—24补全通过；coverage为unverified、requiresHumanReview=true，未冒称完整 | 未通过清单穷尽性：木桌虽在场景核心陈设里出现，但未建立独立props条目；当前模板要求覆盖正文物件，验收清单含木桌 | 未通过完整资产内容验收；F07人工复核提示有效，但没有实现语义穷尽证明 |

Gemini细节例子：林岚 `[7.鼻子]挺直适中`、`[11.发型]日常短发或扎发`、`[18.布料工艺]耐磨棉质布料`。这些可以作为视觉建议，但应明确标记，不能与原文事实混为一谈。DeepSeek多数未明确形象采用“正文未明确；建议...”表述，较好保留边界；仍漏独立木桌道具。

## 验证链路

当前源码 `normalizeTextConfig` → `textRequestPolicy`（实际a6api-chat，保持该渠道协议）→ 当前后台模板 + 身份规则 + 覆盖规则 + 当前compact规则 → 单次供应商HTTP请求 → 当前JSON解析 → 全字段校验 → identity字段 → **实际安装character-parser-v3.js中的parseCharacters** → preserveIdentity → 当前annotateResult → assertNamedPeopleSeparate → assertSourceCoverage → assertFormatCompleteness → 检查两人/仓库/铜钥匙/木桌、灰外套/蓝工服、项目风格、无历史/仙侠泄漏、版式补全 → 人工阅读结果。

安装parser SHA256：`83c3380f6a7a52a36f850b58610de9055793573bb67b88c10bc0687da32df127`。源码与当前模板的快照版本见各report；后续改动不能把本轮结果当成新版本证明。

脚本第一次预检因旧配置快照没有显式protocol被当前policy拒绝，报告actualSupplierRequests=0；按runtime同样调用normalizeTextConfig后补齐已安装协议才发出上述2次请求。无未明提交：每个请求提交前创建`.started.json`，已有标记或actualSupplierRequests>0时脚本再次运行会跳过，不会自动重复扣费。

## 限制与下一步

- 这些是供应商直连实测，**没有经过桌面任务创建、排队、计费、回调、刷新恢复、待确认候选写入及候选UI显示**。这些需要根代理集成验收。
- 无标签来源 `unverified` 的判定已实际验证，但它只准确报告“尚未核验”，不能使内容自动完整；不能据此把F07标为彻底成功。
- 没有生成图片，不能证明五维/双联最终出图排版与角色一致性正确。
- 下一步建议：将已知原文物件/事实与设计建议分离为可审查字段；对必需独立资产建立来源证据与人工清单。新生成请求必须明确安排，不自动拿其他模型补到通过。

## 证据

- `repair-live-extraction.mjs`：实际脚本，已有请求标记防重复。
- `repair-live-extraction-inputs.json`：两种虚构来源。
- `repair-live-extraction-templates.json`：当前启用模板快照。
- `repair-live-extraction-gemini-3.1-pro-preview-original.*` 与 `repair-live-extraction-deepseek-v4-pro-0813-side-portrait.*`：prompt、原始response、content、规范化assets、report和started。
- 各report的 `automatedValidationPassed` 与 `manualReview` 分开，最终 `validated=false`，没有把仅程序合同通过冒充整体验收成功。
