# 逐节事实/建议归属的最小后续方案与五次调用总账

本文件仅提案与总账：未改runtime，未发新模型请求。当前可部署保守v5；v6a/b/c保留候选状态。

## 推荐：结构化逐节来源，由宿主生成归属标签

不推荐继续堆“鼻子/发型/棉布/年龄”等领域关键词正则。它们无法覆盖所有题材、非人角色、群像和语言，也无法判断一个具体描述是否原文事实。

最小可审查的下一合同：人物增加 `sectionProvenance`，只针对角色独有的0—21节，固定22—24由宿主处理：

```json
{"sectionProvenance":[{"section":2,"sourceFacts":[{"text":"成年女性","quote":"成年女维修员","occurrence":1}],"suggestions":["年龄造型建议：25至30岁"]}]}
```

不同时让模型自由生成同义长段与另一份来源清单。对0—21节每一节，宿主直接按已知模板栏目名生成：

1. facts逐条渲染 `【原文事实】text`，quote/occurrence在正文真实定位。
2. suggestions逐条渲染 `【造型建议】text`。
3. 两者空时渲染 `正文未明确`，而不是自动补任意设定。

这样“25—30岁”即使模型擅自提出，也只能从suggestions进入最终绘图提示词，不会因漏标签冒充事实。不要根据字符串是否含“建议”猜测；标签由宿主可靠生成。

字段名可用sourceFacts而非sourceQuotes纯数组，因为需要知道哪段渲染文本具体由哪个原文引文支持。quote存在只证明引文真实，仍不证明text被引文语义蕴含；保守最小模式可以让facts的text必须为quote的连续子串，减少改写事实的空间。对姓名/职业/衣物这类需归并措辞，保留人工核对，不静默让宽松同义匹配过门槛。

0节项目画风来源来自项目配置快照，不必伪造正文引文；可单独sourceKind=projectStyle并用配置哈希。固定排版来源sourceKind=managedTemplate，其余原文quote必须来自本次正文。不要混用三种来源。

## 最小本地校验

- 每节有且仅有一项，编号0—21完整，未知编号/重复/空字段类型拒绝。
- 每条sourceFacts的quote/occurrence真实定位；最保守text逐字属于quote。
- 宿主按结构生成文字，不接受未声明的自由正文混入最终multiViewPrompt。
- 所有suggestions保留明确标签并自动汇总visualProvenance.suggestions；不让模型再维护第二份容易漏项的汇总。
- facts自动汇总sourceFacts，并展示可点击原文证据。
- 旧v5恢复维持原文，不能强制把旧提示词猜成新结构；新版本仅用于新任务。

## 局限与验收风险

- 引文真实不等于语义证明，模型仍可能把“成年”引用用于“25岁”。text必须是quote子串可以拒绝这一例，但不能解决上下文否定、角色归属和同名歧义。
- 来源跨度不能证明全文所有实体都已提取；sourceInventory保持人工审核。
- 结构可能增加token与模型失配率，应删掉重复自由长段，而非再新增等长第三份数据。先离线构建模板与两类角色，再安排有限实测。
- 需确认管理员模板对section编号/标题的实际定义；五维与双联/四联的0—21节并不完全同名，不能硬套同一个标题数组。结构渲染器必须以本次模板schema快照为准。
- 不应为赶验收把已知未标建议的结果通过字符串前加“以下全部为建议”来洗成通过；这会把真实衣物/职业也误标设计。

## 实际提取调用总账（共5次，不含离线回放）

| 编号 | 证据前缀 | 模型/版式 | 本次真实次数 | 供应商耗时 | 程序状态 | 人工内容状态 |
|---|---|---|---:|---:|---|---|
| 1 | repair-live-extraction-gemini-3.1-pro-preview-original | Gemini五维，v5带标签 | 1 | 6.502秒 | 原程序结构通过 | 五官/材质等未标建议，未通过 |
| 2 | repair-live-extraction-deepseek-v4-pro-0813-side-portrait | DeepSeek双联，v5普通小说 | 1 | 60.232秒 | 结构通过，coverage正确unverified | 漏独立木桌，未通过 |
| 3 | repair-live-extraction-v6-gemini-3.1-pro-preview-original | Gemini五维，v6a | 1 | 5.888秒 | 缺sourceInventory/visualProvenance，拒绝 | 多处事实/建议混合，未通过 |
| 4 | repair-live-extraction-v6b-gemini-3.1-pro-preview-original | Gemini五维，v6b唯一合同 | 1 | 7.330秒 | 四数组与来源/建议合同通过 | 场景压缩、陈墨持物不符，未通过 |
| 5 | repair-live-extraction-v6c-gemini-3.1-pro-preview-original | Gemini五维，v6c场景完整 | 1 | 11.319秒 | 首次checker有小数节bug；修复后同响应离线回放通过 | 年龄细化/部分材质未标建议，未通过 |

**合计真实5次，供应商等待约91.271秒；无自动真实重试。** v6c replay-report actualSupplierRequests=0，不是第6次。最早无协议预检actualSupplierRequests=0、语法运行失败、复跑SKIP、纯函数测试与fixture回放都不计调用。

usage合计仅按供应商报告：输入18284，输出19486，合计37770；详见repair-live-extraction-five-call-summary.json。本组这五次不包含前一轮审计的synthetic-*两次。根代理最终总账应明确区分“初始审计2次”与“本轮修复验证5次”。
