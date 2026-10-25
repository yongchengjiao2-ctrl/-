# v7sections独立候选：逐节来源与宿主标签验证

仅新增独立 `src/extraction-section-provenance.js` 与3项单测，没有覆盖v6主文件、没有安装、没有改业务数据库。真实脚本增加 `--v7sections`独立前缀，仅1次Gemini双联虚构样例，7.634秒HTTP200；usage4875输入/2855输出/7730总token。无真实重试。

## 纯函数能力

- 从当前双联/四联管理员模板的完整0—21节栏目清单取schema，不用五维标题套用。五维original显式拒绝为未支持。
- 角色每节sourceFacts[{text,quote,occurrence,sourceKind?}]/suggestions，必须22项编号各一次。
- 正文facts逐条quote真实定位、text必须为quote连续逐字子串，禁止“成年”引文背书“25岁”。项目画风来源仅0节且text逐字等于配置。
- 宿主渲染 `【原文事实】`、`【造型建议】`；两者空则正文未明确。丢弃旧自由multiViewPrompt，按结构重建后调用现有annotate固定双联/四联排版。
- 汇总visualProvenance由宿主生成，不由模型维护第二份可能漏项的自由清单。
- 保留requiresHumanReview，真实子串仍不证明上下文否定、角色归属或全文穷尽。

3项测试通过：真实来源/明确标签/丢弃旧自由文本；伪造年龄/缺项/重复拒绝；项目画风来源限制/五维不支持。日志 `repair-live-extraction-v7sections-tests.txt`。

## 真实响应审查

程序通过：2名角色各22项sectionProvenance；sourceFacts逐条来源真实且属于当前人物身份/衣物；projectStyle只第0节；两角色自由multiViewPrompt被丢弃，重建后每个补充均显式建议标签。木桌独立、铜钥匙、场景12节、sourceInventory五条映射、双联固定22—24节均通过。

逐项人工仍**不能记整个提取成功**：

1. 模型大量suggestions直接写“造型建议：发色设计”“造型建议：脸型骨相设计”“造型建议：服装配色层次设计”等栏目化占位，没有给可执行的具体外观，虽然标签正确，但不能直接绘图。
2. 第1节把“正文未明确具体年龄与籍贯”当suggestion，未知说明应表达为空facts/空suggestions或单独unknown，不应该混进设计建议。
3. 独立normalize输出保留sectionProvenance/sectionReview，但后续现有parseCharacters会丢掉这两个sidecar，脚本最终assets只保留渲染文字和visual汇总；原始response完整保存逐节证据。部署前需要显式保留，而不是假定旧解析器会保留新字段。

本样例的“事实/建议不混标”较此前改善，但“具体实用性”未过，最终report `validated=false`。没有修改输入样例或追加请求凑通过。

## 边界

只供应商直连、独立候选函数与当前校验回放，无桌面任务/计费/候选落库/UI，无真实图像。已有started标记，重复执行SKIP，不再扣费。

下一步若继续，应把未知和建议分开，并要求建议提供明确可用设计值（不能仅把栏目名加“设计”）；纯规则可拒绝“完全等于栏目名/栏目名+设计”等明显占位，但语义可用性仍需人工。不能用无限领域词清单假装完成通用视觉质量验证。

## 追加离线保守占位拦截（没有新模型请求）

新增 `isSectionSuggestionPlaceholder(suggestion,title)`：移除明确建议前缀与标点后，仅拒绝空内容、精确未知/待补充/同上等占位，或严格等于本次模板栏目名、栏目名+设计/设定/细节/描述。它从实际栏目名派生，不维护五官材质等无限词表。

例：“造型建议：发色设计”“【造型建议】脸型骨相设计”拒绝；“自然黑色”“简洁的灰色与深蓝分层”允许。事实溯源要求未放宽；空facts+空suggestions仍显示正文未明确。复杂同义空话、部分栏目词组合仍人工审查，不宣称已能验证语义质量。

新4项纯函数测试通过，更新日志 `repair-live-extraction-v7sections-tests.txt`。真实v7响应会被新占位检查拒绝，保留原report作为当时版本证据，不重写原始响应或追加模型调用。

## parser丢sidecar的精确位置

安装文件 `character-parser-v3.js` 的 `function f` 解析器，`i.push({name:n,aliases:...,role:l,appearance:...,clothing:...,physique:...,personality:...,props:...,consistencyPrompt:...,multiViewPrompt:...,voiceLanguage:d,voiceAge:f,voiceTimbre:p})` 只构造这些legacy字段，没有展开raw对象。

候选normalize已将sectionProvenance/sectionReview写在角色项，但随后 `asset-extraction-runtime-v3.js` 的 `validateAssets` 调 `RFPreserveIdentity(parseCharacters(...),raw)`，preserveIdentity目前仅恢复identityName/entityType/variantName；runtime随后也只恢复visualProvenance，故逐节sidecar消失。

修复建议（尚未执行）：在新的候选版本finalize中，先按NFKC主名称唯一匹配原raw角色，明确恢复 `sectionProvenance/sectionReview`；不要盲目spread raw覆盖legacy已校验字段。恢复后重新运行纯validate/render，派生sectionReview不能直接信模型声明。compiled `mn` 的角色二次解析也需同样保留，或直接使用新finalize返回的已验证角色；不能只修runtime一处。旧v5无需新增这些字段或猜测填充。根统一接入，未编辑compiled。
