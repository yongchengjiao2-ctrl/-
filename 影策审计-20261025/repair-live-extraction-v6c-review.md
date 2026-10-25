# v6c完整场景结构与持物修复验收

未安装、未改数据库。新增 `validateScenePromptSections` 纯函数，新v6要求0/1/2/3/3.5/4/5/6/7/8/9/10共12节各有一处、非空、非明显占位；旧version5恢复不新增该门槛。runtime两条验收路径接入sceneSections报告。builder唯一示例改为完整12节，不以短段代替管理员要求；补角色初/末持物明确说明，视觉建议要求逐节申报。

保留根代理同期加入的 `RFNormalizeIdentity`，没有覆盖。对应mock更新注入实际normalizeIdentityFields，scene fixture按新合同完整提供，不简化身份逻辑。相关17项测试通过：runtime6、scene2、builder2、inventory7。

## 真实1次

`--v6c`独立前缀，Gemini五维一次，HTTP200，11.319秒，usage4340输入/3889输出/8229合计；无重试。原始内容6411字符。

第一次本地验收失败系我新增scene regex错误，把 `[3.5动态元素隔离]` 当成3节。已修正十进制栏目解析并运行回归，随后**只回放同一响应**，没有新请求；原始`.report.json`失败证据保留，`.replay-report.json`记录actualSupplierRequests=0、replayOnly=true和当前完整程序验收结果。

当前实际runtime函数体+安装parser回放通过：12节场景、sourceInventory五条真实引文→五资产、visualProvenance五资产、木桌独立、陈墨props明确接收后持铜钥匙、五维固定人物排版。

## 人工仍未通过全部事实建议边界

- 林岚第2节写年龄约25—30，陈墨约28—35，原文只明确成年；新增细化没有逐处标建议。
- 人物第16—18节部分内搭、剪裁、斜纹棉布等设计没有逐处标建议。
- suggestions仍未详尽列入所有具体设计。

因此只可记“场景结构与持物修复样例通过、v6程序合同通过”，**不能记整个提取功能成功**。报告最终validated=false，保留requiresHumanReview。无桌面任务/落库/计费/候选UI验收，无真实出图。

已发现仅增加自然语言规则并不能可靠保证逐处标建议，进一步可考虑由宿主根据结构化事实/建议字段生成展示，而不是反复让模型自由长段再依靠关键词校验。该方向需要独立设计和实测，不能本次静默放宽验收。
