# F07候选“待人工核对”最小传播方案

只读检查结果：当前compiled `mn` 解析结果后仅return characters/scenes/props，丢掉顶层coverageAssessment、sourceInventory；`an` 把每项完整展开进候选details；`prepareCandidates` 对details做`...d`保留，因此它不是主要丢失位置。

建议在mn返回前调用纯函数 `attachExtractionReview(data)`，先把顶层校验报告投影到每项asset.extractionReview，再按旧三数组返回。无需新增数据库列，不改已确认资产状态，不批量回写旧项目。

建议项结构：

```json
{"extractionReview":{"schemaVersion":1,"requiresHumanReview":true,"status":"unverified","reason":"缺少可核对正文标签，不证明提取完整","checkedScopes":[],"sourceQuotes":[],"visualProvenance":{"status":"not-declared","sourceFactCount":0,"suggestionCount":0},"limitations":"真实引文只证明来源匹配，不证明全文穷尽或事实语义正确"}}
```

v5顶层coverageAssessment有unverified/labeled-partial即可传播；sourceQuotes为空，不虚构v6验证。v6只从本地校验产生的coverageAssessment.sourceInventory.spans取引文，按category映射characters/scenes/props、assetName与实际name/identityName精确匹配。未经验证的raw sourceInventory不作为已核验引文。

visualProvenance只显示本地校验status、原文事实条数和建议条数，不能把sourceFacts文字自动说成真实事实；完整正文保留原details供审阅。

候选界面只在待确认candidate展示“提取结果待人工核对”，细节包括状态、检查范围、可点击原文引文和限制。已确认资产保持其已确认状态，历史extractionReview若仍是requiresHumanReview不能强行把资产降级为pending。新候选的人工核对与资产确认也应分离，只有用户实际核对行为才能产生人工验收记录。

源码拟仅在asset-provenance.js新增纯导出，不改数据库/compiled；compiled由根代理统一增加导入和mn装饰。prepareCandidates现有details展开自然兼容，无需改后端schema。

验收必须覆盖：mn→an→prepareCandidates→JSON存储序列化后review仍在；普通小说显示unverified；标签剧本显示仅部分范围核对；v6引文按类别精确映射；无报告旧任务显示待核实不伪造已检查；confirmed输入status不变；旧project不主动写回。

## 源码实现与验证

已按根授权仅局部修改 `src/asset-provenance.js`，修改前SHA256 `b130dad2c3b9974e3c5dd90c05049151dac0b0ed845ee073461a212e1971d8a5`。保留现有normalizeIdentityFields、来源章节和造型显示。

新增attachExtractionReview、extractionReviewLabel导出，panel合并待核对信息。仅pending/pending_confirmation且未resolved候选显示警示；confirmed/resolved资产不被重新标为待确认，不改其status。无top report旧数据明确unverified，不虚构已核对引文。sourceFacts仅显示声明条数，并说明真实引文不证明语义或穷尽。

新 `tests/audit-extraction-review-propagation.test.js` 4项，覆盖三数组投影→候选prepare→JSON序列化、类别隔离/不信raw quote、confirmed不降级、旧数据不变。与原资产来源7项共 **11/11通过**。这是函数/渲染树验证，不是桌面UI实测或DB写入测试。

compiled mn/an导入与调用由根统一接入；本代理没有安装、没有改编译模块、没有写旧项目。只有根完成compiled传播链路后才可认为F07提示闭环接通，语义穷尽仍未解决。
