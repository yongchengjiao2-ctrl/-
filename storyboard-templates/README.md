# 分镜模板库

当前默认：电影叙事 · 连续分镜标准 `continuous-cinema@1.0.0`。

`registry.json` 保存默认版本、模板目录和 SHA256。每个模板目录包含便于阅读的标准格式和可供程序读取的 template.json。此库与人物资产提取版式独立。

新增格式时新增 ID；修订现有格式时新增版本目录，更新注册表前先检查与当前版本的差异。Skill 单独登记、按需关联到模板，当前 skills 和 skillBindings 为空，表示没有预设或强制附加 Skill。

当前桌面集成源码：`D:/无限画布/character-prompt-formats/src/storyboard-template-standard.js`；当前程序通过 `shot-asset-bindings.js` 导出的 PRESENTATION_RULES 使用它。安装入口为 `install-presentation.py`，不需要重新生成已有镜头。

修改模板不得改变配音原文、资产真实性校验和单次模型请求原则。每次调整应保存旧版本并核对：引用可用性、无参考素材降级为名字、时长累计、保存幂等、Skill边界和项目风格继承。不得用单元测试代替真实生成效果验证。

模板已在本机保存，尚未发布到 GitHub。未来软件升级可能覆盖桌面集成文件，模板库文件仍保留。
