# v6来源清单运行时接入审查

仅修改源码，未安装、未改托管模板/业务数据库、未新增供应商请求。

修改前runtime SHA256：`0111d0084bcace6bbcc30496c0c8ba5a1ff608f350e1e195f8cb31d2e228c398`。

## 局部修改

- `asset-extraction-runtime-v3.js` 导入来源清单规则与纯校验函数，新请求在现有提示词末追加v6合同，metadata写 `extractionContractVersion:6`。
- 保留当前 textRequestPolicy、identityCatalog、identity规则、maximumModelCalls=2、同次提交ID和stampSourceTask逻辑。
- `validateAssets` 在现有parseCharacters与preserveIdentity之后，按NFKC规范化主名称匹配raw原项，把 `visualProvenance` 恢复；不使用别名匹配，不丢现有identity字段。顶层sourceInventory通过原有data展开保留。
- 新请求与v6恢复在原有标签/版式检查后，追加来源清单与事实/建议结构校验，报告存入 `coverageAssessment.sourceInventory/visualProvenance`，人工核对要求不变。
- version5恢复只按原有规则，不要求新字段；旧结果不会被补造清单。
- 来源映射支持实际name或稳定identityName，若同一类别有多个同名身份候选就拒绝歧义；最终映射计数以真实资产name记录。
- 人物视觉建议标签只在角色独有正文中检查，剥除本地追加22—24节/人物排版后再检查，防固定模板中的“造型建议”掩盖前文未标注建议。

## 运行证据

新增 `tests/audit-extraction-runtime-v6.test.js`：提取**当前实际runtime函数体**，mock应用解析器有意丢新字段，验证：

1. 主名trim后visualProvenance与identity字段保留。
2. v6恢复缺inventory、伪造quote、缺映射props拒绝。
3. v5恢复无inventory/visualProvenance仍兼容。
4. 新请求实际metadata/prompt为v6，合法响应只调用一次并保留真实task stamp。
5. 缺inventory响应最多2次，始终不返回成功结果。
6. 本地排版追加段不能替代0—21节中的视觉建议标注。

v6 runtime6项 + 来源纯函数7项 = **13/13通过**。与完整性、既有真实响应回放、资产来源相关回归一起 **33/33通过**，日志 `repair-live-extraction-runtime-v6-tests.txt`。两源码强制ESM语法检查均通过。

## 根审查要求与限制

尚未对v6合同发真实模型请求；之前2次真实请求均是v5，不能作v6成功证据。运行时这次只做真实函数体mock链路，不代表桌面任务/计费/恢复UI通过。

sourceInventory仍来自同一模型，可能漏清单或用non_asset误分类；真实引文不保证分类语义正确。visualProvenance只检查声明结构/显式标签，不保证所有补造型都已申报。不能声称F07穷尽性已彻底解决。

独立visualProvenance字段会增加token；短quote+occurrence避免复制大段正文，但需要真实模型测试确认输出可靠性与调用预算。现有2次内容重生成上限保留，未改变其收费说明。

sourceFacts目前没有逐事实quote绑定，建议分区也没有独立UI展示；现有requiresHumanReview必须继续显示。根代理审查与统一安装后，还需要v6真实供应商及桌面候选保存链路验收。
