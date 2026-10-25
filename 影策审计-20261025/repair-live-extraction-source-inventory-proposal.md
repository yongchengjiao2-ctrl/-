# F07 下一阶段提案：可追溯来源自查与视觉建议分区

本提案响应本轮真实测试发现：DeepSeek普通小说提取漏独立木桌道具；Gemini五维补五官/发型/材质但未标视觉建议。**没有修改现有runtime、托管模板或安装件；没有追加模型请求。**

新增纯函数实验模块 `character-prompt-formats/src/extraction-source-inventory.js` 和 `tests/audit-source-inventory.test.js`。7项最小回归通过。它们尚未接入产品，不能记为F07已修复。

## 1. 同次响应顶层追加 sourceInventory

保留原有 `characters/scenes/props` 三数组，允许附加：

```json
{"sourceInventory":[{"kind":"prop","name":"木桌","quote":"从木桌上拿起","occurrence":1,"assetName":"木桌","disposition":"asset","reason":"正文出现的独立物件"}]}
```

- kind对应character/environment/prop；映射至实际同类数组中的name，不能把清单里的prop映射成场景描述。
- quote必须是本次完整正文连续逐字片段；occurrence是该片段从头第几次出现，宿主计算start/end。避免让模型算UTF-16、Unicode和汉字下标。
- 非空正文至少有一项；没有可制作实体时可kind=other、disposition=non_asset，引用真实结束标记/抽象说明并解释。仍必须人工核对，不能把other当成无资产证明。
- 所有生成资产也必须反向至少有一条来源项，避免多余人物/物件混入。
- 列出木桌却没有props木桌：本地拒绝。不靠“木桌”这个词的硬编码；同样适用于齿轮、文件、交通工具等。
- v6新任务强制sourceInventory；v5及更旧恢复返回legacy-unchecked，不能新规则破坏旧任务恢复。

本地能证明的只有“清单所写引文真实且已映射资产”。模型仍可能从清单本身漏物件，或将资产误报other，或用真实引文给错误实体背书。**requiresHumanReview始终true**，不能命名为fullCoverageVerified。

## 2. 原文事实与视觉建议分开

各资产附加：

```json
{"visualProvenance":{"sourceFacts":["成年女维修员","灰色外套"],"suggestions":["黑色低束发","耐磨棉质翻领夹克"]}}
```

用于绘图的建议不能反写为身份/关系/剧情事实；绘图提示词明确包含“造型建议”或“视觉补全建议”。没有明确资料的字段可以继续写“正文未明确”，不能为了字段有值伪造事实。

最小纯函数只检查声明结构、事实与建议同项冲突，以及存在建议时绘图提示词具有明确标签。它不能语义判定某条建议是否没列出来，也不能证明sourceFacts都来自原文；有来源引文的事实级结构可后续进一步细化。

推荐UI把事实与建议显示为两个区域，确认建议后记录用户采用的设计版本；不要把用户采用的设计建议重标为“原文事实”。

## 3. 接入建议（根代理审查后决定）

1. v6提交时在请求prompt加入 `SOURCE_INVENTORY_RULES`，metadata写 `extractionContractVersion:6`、来源文本SHA256和版本。
2. validateAssets保留sourceInventory与visualProvenance，不让现有parseCharacters丢失附加字段（preserveIdentity目前只保留身份字段，需要显式保留visualProvenance）。
3. 同次模型响应解析后执行 `validateSourceInventory` 与 `validateVisualProvenance`；把派生span和reason写入结果诊断。新任务缺inventory触发现有校验失败路径，但调用数必须仍受2次上限约束。
4. 恢复时按metadata版本决定是否强制v6，旧任务不要补造清单。
5. 候选页保留“待人工核对”，展示原文引文→生成资产关系以及事实/建议分区。用户实际确认后才记录人工验收状态。
6. 预算风险：每资产一个短quote，尽量共享连续场景句，不复制整个长正文；occurrence定位而非每项重复长全文。不要为了少token合并不同主体。

## 4. 实验回归与尚未通过项

7项通过：合法映射；同类资产缺失拒绝；缺inventory/空inventory/伪造quote拒绝；旧版本兼容；重复quote与emoji定位；额外资产/错误分类拒绝；合法non_asset仍人工审查；视觉建议标签与事实冲突（其中一个test组合多个断言）。

没有v6真实模型实测、没有桌面链路验收、没有上屏建议分区、没有后台新operation迁移。因此本提案是可审查实现候选，不能合并成“完成/成功”状态。
