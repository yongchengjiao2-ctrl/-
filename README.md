# 影策本地开发工作区

这是影策桌面版相关程序、补丁、提示词格式、分镜模板和发布脚本的统一 Git 工作区，便于在不同电脑之间拉取、修改和持续更新。

## 在另一台电脑安装与当前桌面一致的版本

下载并安装 [影策 1.3.14 完整桌面快照](https://github.com/yongchengjiao2-ctrl/yingce-desktop-releases/releases/tag/desktop-v1.3.14)。首次安装须将该版本的 `install.cmd` 和 `install.ps1` 下载到同一目录，运行 `install.cmd`。已安装用户使用软件菜单「影策 → 安装或更新影策」。

`git pull` 只更新本开发工作区，不会自动修改 `%LOCALAPPDATA%/YingceCanvas/versions` 下已经安装的软件，也不会更新后台数据库中的提示词。此前推送开发文件不等于发布新的可安装桌面版。

本次发布从 2026-10-27 实际运行的桌面安装目录捕获，包含单次非流式分镜流程、9 项后台提示词、73 项内置技能与本机安装的协议定义。分镜生成代码和其中的系统提示词按实际安装文件原样保存。安装时自动备份并迁移提示词；个人画布、任务、渠道和 API Key 不包含在发布包中，新电脑需单独配置接口。

`desktop-release/snapshot/manifest.json` 记录全部桌面运行文件的 SHA256、与上次公开安装包的差异以及必要的发布入口适配；`snapshot/files/` 保存相对旧安装包新增或改变的可审阅文本文件；`snapshot/portable-state/` 保存可迁移的提示词、内置技能及数据库结构。完整运行环境通过 Releases 分发。

## 目录

- `character-prompt-formats/`：角色提示词格式、安装与修复脚本、测试和源码。
- `storyboard-templates/`：分镜模板与注册表。
- `影策审计-20261025/`：审计、修复及验证代码与报告。
- `yingce-desktop-releases-main/`：桌面版发布与更新脚本。
- `audit_yingce.py`：工作区审计脚本。
- `desktop-release/`：当前桌面实装快照、提示词迁移、验证与完整发布工具。

## 未纳入 Git 的内容

依赖目录、构建结果、测试缓存、个人数据库及修复备份、日志、密钥和大型安装包由 `.gitignore` 排除。后台提示词不能仅靠忽略数据库来同步，因此本次以独立 JSON 导出发布所需配置；不上传整个个人数据库。完整安装包通过 GitHub Releases 发布。

## 在其他电脑继续更新

```powershell
git clone <仓库地址>
cd <仓库目录>
git pull
```

修改后使用 `git add -A`、`git commit` 和 `git push` 同步。
