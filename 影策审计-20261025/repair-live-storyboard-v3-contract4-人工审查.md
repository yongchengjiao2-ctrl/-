# 分镜合同4真实响应人工审查

结论：**机器合同通过，内容验收未通过，不据此安装候选运行时。**

本次使用请求前冻结的 `frozen-v3-contract4-live/`，哈希在 `frozen-v3-contract4-live-manifest.json`。单次 Gemini 请求，HTTP 200，用量 18916 tokens，无自动重试，未写生产项目数据库。实际安装 Skill Runtime 加载真实工作流 9 份必读文件。不是桌面端到端测试。

## 已改善且本样例通过

- 四条配音原文、发声类型与顺序保持，OS镜头闭嘴。
- sourceBeat 为 1、1、2、2，交钥匙只在第3镜执行，第4镜承接已交接结果，未开门或插入钥匙。
- 每镜 sound 未夹带对白或旁白；BGM为无。
- 生成结果与任务恢复结果一致；程序格式和来源合同通过。

## 仍需修复

1. 第1镜写“正轴线右侧”，第2镜“正轴线内侧”，第3镜“正轴线左侧”，未给出可核验的跨轴机位运动或中性过渡。“内侧”不足以证明已经建立中性轴线镜头。已有只匹配显式“越轴/反轴”门禁漏过这类左右换侧描述。
2. 第4镜表演明确“静静伫立”“最终静态姿势”，sound 却为“脚步移动的细微回声”，声画动作不一致。
3. 林岚原文没有性别，模型 voiceLock 指定“成年男性沉稳音色”。这是导演补充设定，不能作为原文事实；需要明确建议来源或由既有角色音色配置提供。
4. 模型响应重复出现 style、rules、inherit、spatial、endVisual 等 JSON 键，JSON.parse 静默采用最后值。当前末态修正依赖最后值，后续应拒绝重复键或改用单一结构，避免审阅原文与解析结果不一致。

## 证据

- 请求：`repair-live-storyboard-v3-contract4-request.json`
- 原始响应：`repair-live-storyboard-v3-contract4-response.json`
- 机器报告：`repair-live-storyboard-v3-contract4-report.json`
- 渲染结果：`repair-live-storyboard-v3-contract4-complete.json`

这些是供应商直连与实际函数链测试，没有覆盖应用HTTP任务提交、真实保存、计费或桌面刷新恢复。
