# 贡献指南 / Contributing

## 开始前

阅读根目录和目标项目的 `README.md`、`AGENTS.md`，以及 [当前交接记录](docs/HANDOFF.md)。Issue、PR 和正式发布目标均为 [CZL-Homelab 组织仓库](https://github.com/CZL-Homelab/Visualization-of-Science-and-Engineering)。先检查工作区与分支，保留未提交改动：

```sh
git status -sb
git remote -v
git fetch origin
# 通常从 main 开始；若任务要求接续 dev，则改用 origin/dev
# 已在相关工作分支上时直接继续，不要重新创建或覆盖它
git switch -c feat/describe-your-change origin/main
```

不要用强推、reset 或清理来处理分支分歧。没有组织写权限时，可以使用用户指定账号的 Fork 工作分支，再向组织仓库的目标分支提交 PR；个人 Fork 不是正式发布入口。GitHub 写操作前用 `gh api user --jq .login` 核对账号，遵守用户的账号和手动合并决定，不自行切换身份。

## 开发与验证

各实验室都修改 `Projects/<slug>/src/`，在对应项目目录运行 `python build.py`，并将生成的 `index.html` 与源码一起提交。无需 npm 或 Python 第三方包。用 `node --check` 检查全部 `src/*.js`，有 `src/modules/` 时也检查其中的脚本，再运行：

| 项目 | 在项目目录执行的检查 | 专门约定 |
| --- | --- | --- |
| Motor Lab | `node tests/check-model.cjs` | [AGENTS](Projects/motor-lab/AGENTS.md) · [README](Projects/motor-lab/README.md) |
| Stock Market Lab | `node tests/check-finance.cjs`；`node tests/check-build.cjs` | [AGENTS](Projects/stock-market-lab/AGENTS.md) · [README](Projects/stock-market-lab/README.md) |
| Desalination Lab | `node tests/check-physics.cjs`；`node tests/check-scenes.cjs`；`node tests/check-build.cjs` | [AGENTS](Projects/desalination-lab/AGENTS.md) · [README](Projects/desalination-lab/README.md) |
| Fusion Lab | `node tests/check-physics.cjs`；`node tests/check-build.cjs` | [AGENTS](Projects/fusion-lab/AGENTS.md) · [README](Projects/fusion-lab/README.md) |
| Distillation Lab | `node tests/check-thermo.cjs`；`node tests/check-build.cjs` | [AGENTS](Projects/distillation-lab/AGENTS.md) · [README](Projects/distillation-lab/README.md) |

共享主题/入场源码位于 `assets/theme.js`、`assets/entry.js` 与 `assets/entry.css`，通过 `scripts/shared_experience.py` 在构建时内嵌。修改公共层需运行 `node scripts/check-theme.cjs` 和两份 JS 的语法检查，重建所有受影响的 Lab，检查目录与所有 Lab 的深浅主题、390px 顶栏、跳过/回放、减少动态效果、离线下载重开；Logo 额外检查 16/24/32px 辨识度。

从根目录运行 `python scripts/check_site.py`，构建目录并核对所有路由、相对资源及跨 Lab 目录；提交前运行 `git diff --check`。纯文档改动检查相关链接、路径与命令即可，不要求重跑无关模型和 UI 测试。

- 主题与导航是共享约定：使用 `czl-lab-theme`，默认跟随系统，保留顶栏返回入口与页脚前实验室目录；新增 Lab 时更新所有实验室目录和 `site/projects.json`，以清单为准。
- UI 变化检查深浅主题、焦点、`aria-pressed`、桌面与 390px 窄屏；3D 还须检查可见性、标签、流向、暂停、手动控制和减少动态效果。提供可复查的截图或录屏，临时截图不进入发布内容。
- 保持单文件离线交付、科学模型边界和素材许可。新的科学断言提供原厂资料、官方技术文档或论文来源，动画不能冒充工程仿真。
- 新项目放在 `Projects/<slug>/`，补齐双语 README、AGENTS、构建与检查说明、教学边界和许可。登记项目清单与预览图，更新根文档、所有 Lab 目录及 CI/Pages；额外运行资源必须显式加入打包逻辑。

## 文档与交接

实现和文档在同一任务、同一 PR 中完成。提交前核对：

- 功能与使用方法：根及项目 README 的项目清单、目录树、路由、运行/构建/测试命令、交互与模型边界，中英文须一致。
- 维护流程：相关指南、`site/README.md`、根及子项目 `AGENTS.md`。出现长期维护经验或规则变化时，应更新 AGENTS.md 自身，纠正旧规则；保留有效的权限、安全、离线和科学准确性约束。
- 更新记录：用户可见变更写入 `CHANGELOG.md`；未发布内容标记为 Unreleased，保留历史条目的原有语境。
- 交接：[docs/HANDOFF.md](docs/HANDOFF.md) 汇总日期、分支/实现提交、完成事项、实际验证和限制、PR/发布状态、下一步、阻塞与用户决定。每次交付或中断前更新，不将聊天全文、凭据或个人环境写入其中。

文档以源码、项目清单、工作流及实际执行结果为准。没有受到影响的文档可以不改；不能仅改中文首页却留下英文、目录树、指南或交接中的旧描述。PR 中说明文档影响及未执行检查的原因。

## 提交、PR 与发布

提交聚焦具体问题。PR 说明结果、改动范围、相关文档、验证与限制；涉及科学内容时说明模型假设。使用 [PR 模板](.github/pull_request_template.md)，不提交凭据、临时文件或无关变更。

当前每个 Lab 各有 Windows/Linux PR 检查工作流，检查构建、脚本语法、对应模型/封装、生成文件一致性及站点链接。审阅通过后按用户授权由维护者合并到目标分支。PR 约定不代表仓库必然启用了强制评审；实际保护规则由管理员管理。

只有组织 `main` 上符合路径条件的推送或手动运行才触发 [Pages 工作流](.github/workflows/pages.yml)。它构建 `site/projects.json` 中登记的所有 Lab、运行检查、打包并部署。文档文件是否触发发布取决于该工作流的路径过滤，不能假定任意文档修改都会发布。

正式站点根路径是项目目录；项目路由见 [根 README](README.md)。Pages Source 为 GitHub Actions，发布使用 `GITHUB_TOKEN`，不在源码保存个人令牌。合并后核对 Actions 及线上内容，并更新交接中的实际结果。提交、推送、合并和上线是不同状态；未获授权时不自行合并或发布。

## English

### Start and implement

Read the root and target README/AGENTS and [current handoff](docs/HANDOFF.md). Inspect the working tree, branch and remotes, then fetch the organization upstream. The commands above normally start a new branch from `origin/main`; use `origin/dev` when continuing development requested there. Continue an existing relevant working branch rather than replacing it. Preserve collaborators' changes and do not reset, clean or force-push to resolve divergence.

Contributors without organization write access may use a working branch in the user-designated account's fork to open an organization PR. Keep the organization as the canonical upstream and production host. Verify the active account with `gh api user --jq .login`; honor account and manual-merge decisions without switching identities on your own.

Every lab edits `Projects/<slug>/src/`, build with `python build.py` in that project, and commit generated `index.html` with source. No npm or third-party Python installation is needed. Check all source scripts with `node --check`, including module scripts where present, then run the exact project tests listed in the table above. For shared theme/entrance changes, edit assets/theme.js, entry.js and entry.css (inlined by scripts/shared_experience.py), run `node scripts/check-theme.cjs` plus shared-script syntax checks, rebuild affected labs and check the catalog/all labs in both themes at desktop/390px, skip/replay, reduced motion and reopened offline downloads. Check logo legibility at 16/24/32px. From the repository root run `python scripts/check_site.py` for routes, relative resources and every lab directory, and `git diff --check`. Documentation-only work requires relevant link, path and command checks rather than unrelated model/UI reruns.

Preserve offline packaging, scientific boundaries and attribution. Reference primary sources for new scientific claims. Check UI in both themes at desktop and 390px; check 3D visibility, annotations, flow direction, pause, manual control and reduced motion. Keep review screenshots outside deployment. A new project needs bilingual README/AGENTS, build/test/model/license guidance, registry and preview entries, every lab directory, relevant root documentation and CI/Pages integration. Extend packaging explicitly for additional runtime resources.

### Documentation and handoff

Finish implementation and affected documentation in the same task and PR. Check root/project READMEs for project lists, source trees, routes, run/build/test commands, interactions and model boundaries in both languages. Update relevant guides, site/README and root/project AGENTS, including AGENTS itself, when durable maintenance rules change. Correct obsolete rules while retaining applicable authorization, safety, offline and scientific-accuracy constraints.

Record user-visible changes in CHANGELOG, marking unreleased work as Unreleased and preserving historical context. Before delivery or interruption, update docs/HANDOFF.md with the date, branch/implementation commit, completed work, observed checks and limits, PR/release state, next steps, blockers and key user decisions. Keep one current handoff and exclude chat transcripts, credentials and personal environments.

Use the source, registry, workflows and observed results as evidence. Leave unaffected documents alone, but do not update only the Chinese overview while English text, trees, guides or handoff remain stale. Describe documentation impact and any skipped checks in the PR.

### Review and release

Use focused commits and the [PR template](.github/pull_request_template.md). Explain outcomes, scope, documentation, validation and limits, including model assumptions where relevant. Exclude credentials, temporary artifacts and unrelated edits.

Each lab has Windows/Linux PR checks covering builds, syntax, applicable models/packaging, generated output and site links. Maintainers merge to the target branch within user authorization. Review conventions do not assert that branch protection is enforced; administrators manage those settings.

The organization Pages workflow runs on matching `main` pushes or manual dispatch. It builds and verifies every lab registered in `site/projects.json`, packages and deploys the site. Documentation triggers depend on its actual path filters; not every Markdown change triggers deployment. Use GitHub Actions as Pages Source and the workflow's GITHUB_TOKEN rather than committed personal tokens. After merge, inspect Actions and live content, then update the handoff with the observed result. Committed, pushed, merged and deployed are distinct states; do not merge or publish without authorization.
