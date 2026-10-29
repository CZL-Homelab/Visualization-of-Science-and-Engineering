# AI 协作约定

适用于本仓库所有目录；进入子项目后还须阅读更具体的 `AGENTS.md` 和 `README.md`。用户当前会话中的明确授权与约束优先。

## 仓库和交付目标

- 唯一上游与默认推送目标：`https://github.com/CZL-Homelab/Visualization-of-Science-and-Engineering.git`。
- 正式站点：`https://czl-homelab.github.io/Visualization-of-Science-and-Engineering/`。
- 不向个人账号下的历史仓库同步，不把个人站点写为正式入口。
- 工作开始检查 `git status --short`、当前分支和 `git remote -v`。保留其他开发者的改动，不擅自 reset、清理、强推或改写历史。
- 新工作默认使用描述性的功能分支和 PR。若当前会话已经明确授权直接提交、同步或发布，按已有授权执行，不重复请求批准。

## 实现要求

- 每个演示放在 `Projects/<slug>/`，先读项目说明再修改。
- 优先修改源码并执行构建；生成文件是否提交以项目说明为准。Motor Lab 的 `index.html` 必须与源码一起更新。
- 不给原本离线的演示加入 CDN、在线字体、远程模型或运行时联网依赖，除非任务明确要求。
- 科学内容优先准确：区分电流、磁动势、磁通、转速与角度；写明几何和物理简化。程序动画不能冒充工程仿真。
- 增加零件或动画时检查实际可见性、遮挡、相位和指向，不以“脚本没报错”代替视觉验收。
- 自动演示应可暂停，手动控制应稳定；遵循 `prefers-reduced-motion`。不默认播放语音。
- 不移除已有许可证和署名。不得提交凭据、令牌、私钥、个人环境或调试输出。

## 验证和 Git 协作

- 运行相关构建、语法检查及有意义的物理不变量测试。UI 改动检查桌面和窄屏，并报告未能执行的检查。
- 修改 Motor Lab 时，按其子目录说明验证；不要为了低影响文档修改引入实现镜像测试。
- 提交前检查 `git diff --check`、改动范围和生成文件。不要顺手重排第三方库或整个仓库。
- `work/`、缓存和临时截图不作为新的发布内容；历史已跟踪的备份未经要求不删除。
- 发布由组织仓库 `.github/workflows/pages.yml` 管理。扩展发布时保留已有项目路由，不上传中间文件。
- 不擅自改变组织权限、分支保护或第三方账号设置；发布授权不等于组织治理授权。
- 完成后说明改动、验证、提交/PR 和实际部署状态，区分“已推送”与“已上线”。

- 根目录必须保留项目目录页；新项目登记在 site/projects.json。共享标识在 assets/icon.svg，调整仓库标识不代表更改组织头像。
- 仓库说明文档使用中文与英文双语；法律许可证保留原文。

## English — instructions for AI contributors

These instructions cover the entire repository. Read the project README and any more specific AGENTS.md before editing. Explicit authorization and constraints in the current user session take precedence.

### Repository and delivery

- The only upstream and default push target is `https://github.com/CZL-Homelab/Visualization-of-Science-and-Engineering.git`. The production site is `https://czl-homelab.github.io/Visualization-of-Science-and-Engineering/`.
- Do not synchronize to historical personal repositories or present personal sites as canonical.
- Start by inspecting the working tree, branch and remotes. Preserve other contributors' changes; do not reset, clean, force-push or rewrite history without authorization.
- Prefer a descriptive feature branch and PR. Existing explicit authorization to commit, synchronize or publish remains valid; do not request it again.

### Implementation

- Keep demonstrations under `Projects/<slug>/`. Edit source and run the documented build. Motor Lab's generated index.html must be committed with source changes.
- Preserve offline behavior; do not introduce CDN scripts, online fonts, remote models or runtime network dependencies unless explicitly requested.
- Keep scientific concepts accurate and distinguish current, magnetomotive force, flux, speed and angle. Disclose simplifications; animation is not an engineering simulation.
- Check visibility, occlusion, phase and arrow direction visually. A clean console alone is insufficient.
- Automatic presentations must be pausable, manual controls stable, reduced-motion preferences respected, and speech opt-in.
- Preserve licenses and attribution. Never commit credentials, private keys, personal environment files or debugging output.

### Validation and collaboration

- Run relevant builds, syntax checks and meaningful physical invariants. Check desktop and narrow layouts for UI changes and report verification limits. Do not add implementation-mirroring tests for small documentation edits.
- Review the diff, generated artifacts and git diff --check. Do not reformat third-party libraries or unrelated code.
- Do not add temporary work, caches or screenshots to deployment. Preserve previously tracked historical backups unless asked to change them.
- Organization Pages is managed by .github/workflows/pages.yml. The root route must remain a project catalog; preserve existing routes. Register projects in site/projects.json and extend packaging if extra files are required.
- Shared identity lives in assets/icon.svg. Preserve its offline embedding in Motor Lab; do not change the organization avatar when asked to adjust repository branding.
- Keep repository documentation bilingual in Chinese and English. Preserve original legal license text.
- Do not change organization permissions, branch protection or external account settings without authorization. Publishing authorization does not imply governance authorization.
- Report changes, validation, commit/PR and actual deployment outcome. Distinguish pushed code from a successfully published website.
