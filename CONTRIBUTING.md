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
- Stock Market Lab 修改 `Projects/stock-market-lab/src/`，运行 `python build.py`、`node tests/check-finance.cjs` 与 `node tests/check-build.cjs`，并提交生成的 `index.html`。
- 主题与导航是共享约定：统一使用 `czl-lab-theme`，默认跟随系统；实验室顶栏保留返回 `Lab Projects` 的入口，页脚前保留实验室目录。新增 lab 时同步更新两份目录、`site/projects.json` 和文档。
- 同时检查深色与浅色：正文/图表对比度、焦点环、主题按钮的 `aria-pressed`，以及 390px 窄屏下返回入口和目录不溢出。
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
- Motor Lab 路径：`/motor-lab/`；仓库根网页为可搜索的项目目录。
- Pages Source 使用 GitHub Actions；仓库和工作流需要允许 Actions 执行。
- 合并后先检查 CI/部署结果，再确认网页内容。失败时查看具体任务日志，修复后重新运行或推送修复提交。
- 不将个人 GitHub 令牌写入仓库。当前发布通过 `GITHUB_TOKEN` 和 Pages 环境完成。
- Git 推送成功不等于部署成功；对外报告实际状态。

## English — contributing

Read the root and target project's README.md and AGENTS.md. Issues, PRs and production publishing belong to the CZL-Homelab repository linked above.

Start from an up-to-date main using the branch commands in the Chinese section. Save existing work first. If a fast-forward pull fails, inspect the divergence; never force-push over another contributor. Contributors without organization write access can fork the organization repository and open a PR against its main branch.

Edit Motor Lab source under Projects/motor-lab/src, run python build.py, and commit the generated index.html alongside the source. For Stock Market Lab, use Projects/stock-market-lab/src and its two Node checks. Keep both demos single-file and offline, and avoid unnecessary dependencies. Theme and navigation are shared conventions: use the `czl-lab-theme` key, the system preference as default, a `Lab Projects` header link and a pre-footer lab directory in each lab; update both directories and site/projects.json when adding one. Check both palettes, focus states and narrow layouts. For new scientific claims, link manufacturer documentation, primary technical references or papers and state model assumptions. UI changes should include screenshots or recordings and checks for motion, pause, occlusion and narrow layouts. Preserve dependency and asset provenance and licensing.

New demonstrations belong under Projects/<slug> with independent environment, build, validation, model-boundary and license documentation. Register the project in site/projects.json. The directory builder currently packages each project's standalone index.html; extend it explicitly for additional required files. Update bilingual documentation and route checks.

Run the relevant project's checks and git diff --check before committing. Motor Lab invariants cover three-phase fields, slip, commutation signs, pole geometry and offline packaging. Keep commits focused, describe user-visible behavior, and document validation limits. Never commit credentials, new temporary backups, caches or unrelated changes.

PR CI runs Windows and Linux builds and verifies syntax, model invariants, generated pages and directory links. Maintainers review and merge to main; publishing runs only in the organization repository. PR review is the collaboration convention, not a claim that branch protection is enforced; administrators control actual settings.

Production is hosted under czl-homelab.github.io/Visualization-of-Science-and-Engineering/. The root route is the project directory; Motor Lab remains under /motor-lab/. Set Pages Source to GitHub Actions. Workflows use GITHUB_TOKEN rather than stored personal tokens. After merging, inspect CI and deployment logs and verify the live page; a successful push alone is not a successful deployment.
