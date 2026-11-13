# AI 协作约定

适用于本仓库所有目录；开始工作先读 [README.md](README.md)、[CONTRIBUTING.md](CONTRIBUTING.md) 和最新的 [交接记录](docs/HANDOFF.md)，进入子项目后还须阅读更具体的 `AGENTS.md` 和 `README.md`。用户当前会话中的明确授权与约束优先。

## 仓库和交付目标

- 唯一上游与默认推送目标：`https://github.com/CZL-Homelab/Visualization-of-Science-and-Engineering.git`。
- 正式站点：`https://czl-homelab.github.io/Visualization-of-Science-and-Engineering/`。
- 不向个人账号下的历史仓库同步，不把个人站点写为正式入口。
- 无组织写权限时，可以使用用户指定账号的 Fork 工作分支向组织仓库提交 PR；组织仓库仍是唯一上游。执行 GitHub 写操作前核对账号；不要为合并或发布自行切换到其他账号。
- 工作开始检查 `git status --short`、当前分支和 `git remote -v`。保留其他开发者的改动，不擅自 reset、清理、强推或改写历史。
- 新工作默认使用描述性的功能分支和 PR。若当前会话已经明确授权直接提交、同步或发布，按已有授权执行，不重复请求批准。

## 实现要求

- 每个演示放在 `Projects/<slug>/`，先读项目说明再修改。
- 优先修改源码并执行构建；当前所有实验室的生成文件 `index.html` 都必须与源码一起提交，具体检查见项目 README。
- 不给原本离线的演示加入 CDN、在线字体、远程模型或运行时联网依赖，除非任务明确要求。
- 科学内容优先准确：区分电流、磁动势、磁通、转速与角度；写明几何和物理简化。程序动画不能冒充工程仿真。
- 增加零件或动画时检查实际可见性、遮挡、相位和指向，不以“脚本没报错”代替视觉验收。
- 自动演示应可暂停，手动控制应稳定；遵循 `prefers-reduced-motion`。不默认播放语音。
- 主题与导航属于全站约定。统一使用 `czl-lab-theme`，默认跟随 `prefers-color-scheme`；页面在首次绘制前设置 `data-theme`，主题按钮提供可读名称与 `aria-pressed`，并同步 `meta[name="theme-color"]`。
- 每个实验室顶栏左侧提供返回 `Lab Projects` 目录的入口，页脚前提供列出全部实验室的目录并标记当前页；新增实验室时同步更新所有实验室的目录与 `site/projects.json`，以清单为准，不沿用旧项目数量。链接必须能在 Pages 子路径和本地 `file://` 下解析。
- 主题与导航不得引入远程样式、脚本或字体；深浅色都要检查正文对比度、图表颜色、焦点环和窄屏，不得只验证默认主题。
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

## 全站体验特性：标识、入场与主题

- 共享标识源为 `assets/icon.svg`；保留石墨底、灰白空间框架及少量青/蓝/铜色点缀，检查 16/24/32px 与展示尺寸的辨识度。目录相对引用，各 Lab 构建时内嵌，不在生成页另画或复制一版标识。
- 目录与四个 Lab 都提供简短入场动效，识别图形可随学科变化，但行为一致：自动结束、可立即跳过、顶栏可回放、不锁滚动、不抢焦点、不伪装为加载进度。深链直接打开目标内容；页面隐藏或用户开始操作时及时清理。
- `prefers-reduced-motion` 开启时跳过入场、禁用回放和内容位移；偏好在运行中改变也应立即生效。入场结束或跳过后移除临时节点；离线下载后的页面重新打开不能产生重复的动效或按钮。
- 默认主题跟随系统，与时钟/白天黑夜时段无关；只记住用户显式选择到 `czl-lab-theme`。未手动选择时跟随系统实时变化，手动选择后保持该选择；页脚“主题：跟随系统”可恢复自动模式。存储禁用或值无效时仍跟随系统，当前会话的手动选择仍有效。
- 主题须在首次绘制前应用，按钮名称、`aria-pressed`、`theme-color`、图表和三维引擎同步；同源页面通过 storage 事件同步。旧 `sml.theme` 只用于迁移，不再维护两套偏好。
- 公共源码：`assets/theme.js`、`assets/entry.js`、`assets/entry.css`；由 `scripts/shared_experience.py` 将 `THEME_BOOT` 和 `SHARED_EXPERIENCE` 占位符内嵌到目录/各 Lab。各项目 `initTheme()` 只挂接公共控制器和必要的引擎回调，不重新复制主题实现。
- 公共体验改动运行 `node scripts/check-theme.cjs`、公共 JS 语法检查、受影响项目构建与封装、站点检查；视觉检查目录及所有 Lab 的深浅主题、390px 顶栏、跳过/回放/键盘、减少动态效果和离线重开。报告实际检查范围，按影响决定是否需要重测模型交互。

## 文档与交接也是交付内容

- 不以“代码已经完成”作为任务完成标准。每次修改都要检查受影响的说明和指南，并在同一任务、同一 PR 中同步更新；不能把文档留待用户提醒。
- 功能、项目数量、路由、交互方式或模型边界变化：更新根 `README.md` 和相关项目 README，核对目录树、快速开始及中英文说明。构建、测试、依赖或发布流程变化：同步 `CONTRIBUTING.md`、`site/README.md` 等相关指南及其实际命令。
- 发现新的长期维护约定、源码入口、验证要求或协作流程时，主动更新根或子项目 `AGENTS.md`，包括本文件。纠正过时规则，保留仍有效的用户权限、安全、离线和科学准确性约束；不要把一次性的账号、分支或任务状态写成永久规则。
- 对用户可见的变更，在 `CHANGELOG.md` 增加对应条目；未合并或未发布的变更标为“未发布 / Unreleased”，保留历史条目的时间和语境，不能把旧记录改写成当前状态。
- 每次交付或中断前更新 [docs/HANDOFF.md](docs/HANDOFF.md)：记录日期、分支与实现提交、已完成事项、实际执行的验证及限制、PR/部署状态、待办和阻塞、用户已作的关键决定。将最新状态汇总到该文件，不散落为多份聊天记录；不存凭据、个人环境或调试输出。
- 文档以当前源码、`site/projects.json`、工作流和实际检查结果为依据；检查本地链接和命令路径，中英文保持同一事实。明确区分“已实现、已提交、已推送、已合并、已上线”。不能验证的结果明确说明，不能沿用上次任务的“已通过”来描述新提交。
- 纯文档修改执行相关链接/命令核对和 `git diff --check` 即可，无须重跑无关的 UI 或物理测试。某份文档确实不受影响时保持不动；有实质改动却缺少相应文档或交接更新，任务不算完成。

## English — instructions for AI contributors

These instructions cover the entire repository. Start with the root README, CONTRIBUTING and [current handoff](docs/HANDOFF.md), then read the target project's README and any more specific AGENTS.md. Explicit authorization and constraints in the current user session take precedence.

### Repository and delivery

- The only upstream and default push target is `https://github.com/CZL-Homelab/Visualization-of-Science-and-Engineering.git`. The production site is `https://czl-homelab.github.io/Visualization-of-Science-and-Engineering/`.
- Do not synchronize to historical personal repositories or present personal sites as canonical.
- Contributors without organization write access may use a working branch in the user-designated account's fork to open an organization PR. The organization remains the only upstream. Verify the account before GitHub writes; do not switch accounts for merge or deployment without authorization.
- Start by inspecting the working tree, branch and remotes. Preserve other contributors' changes; do not reset, clean, force-push or rewrite history without authorization.
- Prefer a descriptive feature branch and PR. Existing explicit authorization to commit, synchronize or publish remains valid; do not request it again.

### Implementation

- Keep demonstrations under `Projects/<slug>/`. Edit source and run the documented build. All current labs commit their generated index.html with source changes; follow each project's README for checks.
- Preserve offline behavior; do not introduce CDN scripts, online fonts, remote models or runtime network dependencies unless explicitly requested.
- Keep scientific concepts accurate and distinguish current, magnetomotive force, flux, speed and angle. Disclose simplifications; animation is not an engineering simulation.
- Check visibility, occlusion, phase and arrow direction visually. A clean console alone is insufficient.
- Automatic presentations must be pausable, manual controls stable, reduced-motion preferences respected, and speech opt-in.
- Theme and navigation are repository-wide conventions. Use the shared `czl-lab-theme` key, default to `prefers-color-scheme`, set `data-theme` before first paint, and expose a real button with an accessible name, `aria-pressed` and an updated `meta[name="theme-color"]`.
- Every lab header links back to the `Lab Projects` catalog, and a pre-footer directory lists all labs and marks the current page. Register a new lab in every lab directory and `site/projects.json`; derive coverage from the registry rather than an old project count. Links must resolve under the Pages subpath and from local `file://` previews.
- Theme and navigation must not add remote styles, scripts or fonts. Verify contrast, chart colors, focus rings and narrow layouts in both themes, not only the default one.
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

### Documentation and handoff are part of delivery

- Code alone does not complete a task. Inspect affected documentation and update it in the same task and PR, without waiting for a user reminder.
- Changes to features, project counts, routes, interactions or model boundaries require the root and project READMEs to be checked, including source trees, quick starts and both languages. Changes to builds, tests, dependencies or publishing require the relevant CONTRIBUTING, site guidance and actual commands to stay consistent.
- Update root or project AGENTS.md, including this file, when source entry points, verification requirements or durable maintenance/collaboration rules change. Correct obsolete rules while preserving applicable user-authorization, safety, offline and scientific-accuracy constraints. Keep temporary account, branch and task state in the handoff rather than permanent rules.
- Add user-visible changes to CHANGELOG.md. Mark changes that are not merged or released as “Unreleased”; preserve historical dates and context instead of rewriting old entries as current behavior.
- Before delivery or interruption, update [docs/HANDOFF.md](docs/HANDOFF.md) with the date, branch and implementation commit, completed work, checks actually run and their limits, PR/deployment state, remaining work/blockers and key user decisions. Keep one current handoff instead of scattered chat transcripts; exclude credentials, personal environments and debug output.
- Ground documentation in the source, site/projects.json, workflows and observed checks. Verify local links and command paths and keep both languages aligned. Distinguish implemented, committed, pushed, merged and deployed states. Never carry a previous commit's successful checks forward as evidence for a new commit.
- For documentation-only changes, check relevant links/commands and git diff --check; do not repeat unrelated UI or physics tests. Leave unaffected documents alone. Material changes without corresponding documentation and handoff updates are incomplete.

### Shared identity, entrance and theme features

- `assets/icon.svg` is the identity source: graphite, a gray/white structural frame and restrained cyan/blue/copper accents. Check 16/24/32px and display sizes. The catalog references it relatively; labs embed it at build time instead of drawing separate copies.
- The catalog and all labs have a short entrance with subject-specific motifs and consistent behavior: finite duration, immediate skip, header replay, no scroll locking, focus stealing or fake loading progress. Deep links open directly; clean up when hidden or when the user starts interacting.
- Reduced motion skips the entrance, disables replay and removes content movement, including preference changes at runtime. Remove temporary nodes after dismissal and avoid duplicate entrances/controls when reopening downloaded HTML.
- Default theme follows the system, not the clock or a day/night schedule. Persist only explicit choices under `czl-lab-theme`. Follow live system changes until overridden; the footer's system-theme button restores automatic mode. Invalid/denied storage still allows system defaults and in-memory manual choices.
- Apply theme before first paint and synchronize accessible button state, theme-color, charts and 3D. Synchronize same-origin pages through storage events. Migrate legacy `sml.theme` rather than maintaining two preferences.
- Shared sources are assets/theme.js, entry.js and entry.css. scripts/shared_experience.py inlines THEME_BOOT and SHARED_EXPERIENCE hooks into the catalog and labs. Project initTheme functions mount the shared controller and any necessary engine callback; do not duplicate the implementation.
- For shared experience changes, run scripts/check-theme.cjs, shared-script syntax checks, affected builds/packaging and site checks. Visually check catalog/all labs in both themes, 390px headers, skip/replay/keyboard, reduced motion and offline reopening. Report actual coverage and retest model interaction according to impact.
