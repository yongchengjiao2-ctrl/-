# 影策本地开发工作区

这是影策桌面版相关程序、补丁、提示词格式、分镜模板和发布脚本的统一 Git 工作区，便于在不同电脑之间拉取、修改和持续更新。

## 目录

- `character-prompt-formats/`：角色提示词格式、安装与修复脚本、测试和源码。
- `storyboard-templates/`：分镜模板与注册表。
- `影策审计-20261025/`：审计、修复及验证代码与报告。
- `yingce-desktop-releases-main/`：桌面版发布与更新脚本。
- `audit_yingce.py`：工作区审计脚本。

## 未纳入 Git 的内容

依赖目录、构建结果、测试缓存、数据库及修复备份、日志、密钥和大型安装包由 `.gitignore` 排除。这些内容属于本机运行数据或发布制品，不适合作为源码提交。安装包应通过 GitHub Releases 发布。

## 在其他电脑继续更新

```powershell
git clone <仓库地址>
cd <仓库目录>
git pull
```

修改后使用 `git add -A`、`git commit` 和 `git push` 同步。
