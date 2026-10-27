# 桌面实装快照发布

发布基准是实际桌面快捷方式启动的安装目录，而不是旧补丁脚本或尚未安装的 src 文件。

- 完整发布：1.3.14，基于本机 1.3.13 实装状态。
- `build_snapshot.py --capture`：从 current.txt 指定的实装目录捕获所有运行文件，从 SQLite 一致性只读事务中导出后台提示词和内置技能，校验协议包。
- `verify_snapshot.py`：逐文件哈希核对、9 项提示词逐字对比、迁移备份与幂等性、个人配置保留、真实打包后端隔离启动与提示词保留验证。
- `build_snapshot.py --package`：生成完整 ZIP 和全文件 SHA256 清单。
- `github_release.py --prepare/--upload/--publish`：先上传草稿，校验 GitHub 返回的所有资产 SHA256 后发布为最新版本。GitHub 凭证仅从 Git Credential Manager 读取到内存，不导出。

`snapshot/manifest.json` 的 runtimeFiles 记录原桌面文件哈希。除 `packagingAdapter` 说明的 app.asar 一次迁移入口及显示版本外，发布的原运行文件必须与该记录完全一致。新增加的迁移脚本在首次启动前导入 9 项提示词和协议定义；后续启动不重置用户自行修改的模板。为兼容旧版安装器，配置及迁移脚本置于允许的 backend/desktop-state 路径。

完整 ZIP、临时数据库和隔离测试目录均在被 Git 忽略的 work/ 或 verification/ 内。禁止将个人数据库、.settings-key、浏览器配置或 API Key 加入发布。仅剔除不属于软件功能的本机审计正文输入 extraction-live-test-input.json。

本次不把源码候选覆盖到桌面，也不重跑历史补丁安装器；保留当前用户认可的软件行为。端到端验证不发起付费模型调用。
