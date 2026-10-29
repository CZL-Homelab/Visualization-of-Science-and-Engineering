# 贡献指南

## 开始前

阅读根目录和目标项目的 `README.md`、`AGENTS.md`。所有 Issue、PR 和发布目标均为 [CZL-Homelab 组织仓库](https://github.com/CZL-Homelab/Visualization-of-Science-and-Engineering)。

```sh
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feat/describe-your-change
```

若有未提交改动，请先自行保存或完成当前工作。`--ff-only` 失败时先检查分支分歧，不用强推覆盖。没有组织写权限的贡献者可以从组织仓库 Fork，再向组织的 `main` 提 PR。

## 开发和内容

- Motor Lab 修改 `Projects/motor-lab/src/`，运行 `python build.py` 并一同提交生成的 `index.html`。
- 保持单文件离线交付，不新增不必要的安装依赖。
- 原理说明写清因果链；对新的物理断言提供原厂资料、官方技术文档或论文链接。
- UI 变化请提供截图或短录屏，并检查动画、暂停、标签遮挡和窄屏。
- 依赖或素材变更要保留来源与许可，使用相对资源路径以支持项目子路径发布。
- 新项目使用 `Projects/<slug>/`，独立列出运行环境、构建、验证、教学边界及许可，并更新根 README 和发布路由。

## 提交与 PR

提交前运行目标项目文档中的检查及 `git diff --check`。Motor Lab 的核心检查是 `node tests/check-model.cjs`，检查三相矢量、转差、换向符号、磁极几何和离线封装。

提交聚焦同一问题，标题描述行为变化。PR 说明问题、改动、验证与限制；涉及科学内容时解释模型假设。生成文件要与源码一致，不提交新的缓存、备份、令牌或临时截图。

PR 的 **Motor Lab checks** 工作流在 Windows 和 Linux 构建、执行语法及物理检查，并验证生成文件。维护者审核后合并到 `main`；发布工作流只在组织主仓库部署。文档贡献同样欢迎。

默认使用 PR 是协作约定；此仓库是否启用强制评审或分支保护，以组织管理员的实际配置为准。

## 发布和故障定位

- 正式域名：`https://czl-homelab.github.io/Visualization-of-Science-and-Engineering/`。
- Motor Lab 路径：`/motor-lab/`；仓库根网页跳转到该路径。
- Pages Source 使用 GitHub Actions；仓库和工作流需要允许 Actions 执行。
- 合并后先检查 CI/部署结果，再确认网页内容。失败时查看具体任务日志，修复后重新运行或推送修复提交。
- 不将个人 GitHub 令牌写入仓库。当前发布通过 `GITHUB_TOKEN` 和 Pages 环境完成。
- Git 推送成功不等于部署成功；对外报告实际状态。
