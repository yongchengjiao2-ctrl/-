# v6b最终单一合同修复与真实验证

仅源码变更，未安装，未改管理员模板/数据库。新增 `src/extraction-contract-builder.js` 并在现runtime局部接入。

## 修复内容

本次不再先注入旧“三数组”JSON示例、然后仅append v6文字。请求快照保留管理员提取/版式正文至 `【输出数据合同】` 前，替换其旧传输合同；末尾统一给一个完整四数组结构示例，每资产都有身份、visualProvenance，顶层含sourceInventory。模板数据库正文没有被修改。保留identity、coverage、compact和原输入，明确性格不得由动作推断、所有未知视觉设计逐处标建议。

未强制任何Provider使用JSON schema。继续保留textRequestPolicy为a6api-chat生成的json_object方式，不改变原生协议或用户其它设置。当前成功不能推断原生Claude/Gemini已验收。

## 真实请求

脚本新增 `--v6b`，独立证据前缀防重复。只向Gemini五维发送 **1次**虚构林岚/陈墨/仓库/铜钥匙/木桌请求，不自动重试。

HTTP200，application/json，stop，耗时7.330秒；usage输入3294、输出2043、总5337。当前runtime源码SHA256 `f1566a3b92d447c8fc7c153de6e73f7f8d70d1246d6c6accca606313e70b471a`。

程序验证通过：

- 四个顶层数组齐全，2人物、1场景、2道具。
- 五个资产visualProvenance齐全。
- 实际安装parseCharacters及当前runtime真实validateRecoveredExtraction函数体通过。
- 5条来源清单引文逐字匹配真实输入并映射5个资产。
- 木桌作为独立props出现。
- 人物personality均写正文未明确；未知五官、发型、材质在人物提示词逐处标造型建议，声音标建议。
- 五维固定人物排版由宿主按模板追加，原文衣物灰外套/蓝工服保留。

## 人工审查仍未完全通过

本次v6传输缺字段问题已在这个短样例通过，但**不能计整个提取功能验收成功**：

1. 场景prompt压成单段，未按管理员要求保留0—10节具体结构，门窗/动态隔离/摄影视角等未分别给出。
2. 陈墨角色props字段写“无”，原文明确林岚将钥匙交给陈墨，持物状态需要与实际交接动作一致。
3. suggestions数组只写粗略概括，人物prompt具体新增身高165/178等没有逐项列入建议清单。虽然正文都标了建议，仍不能证明全部申报完整。

因此report保留 `automatedValidationPassed=true` 与 `manualReview.semanticAcceptance=false`，最终 `validated=false`。没有为了通过而更改源文本或放宽检查，没有第二次请求。

## 回归与限制

builder2项+runtime6项+inventory7项+本次真实证据回放2项，**17/17通过**，日志 `repair-live-extraction-v6b-tests.txt`。真实失败v6响应仍被拒绝；没有重写旧报告作成功。

本次仅供应商直连，无桌面任务/排队/计费/刷新/候选落库/UI验收，无生图。根代理UI工具当前受工作设置限制，不能据此宣称UI通过。

进一步需要：场景/道具结构化栏目强校验、角色动作持物一致性和建议清单覆盖度；来源清单仍为模型自查，可能漏项，requiresHumanReview保持true。
