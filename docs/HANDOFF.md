# 当前交接 / Current handoff

核对日期 / Checked: **2026-11-13（Asia/Shanghai）**。此文件是可更新的当前状态摘要；历史功能变更见 [CHANGELOG](../CHANGELOG.md)，长期协作规则见 [AGENTS](../AGENTS.md)，构建与提交流程见 [CONTRIBUTING](../CONTRIBUTING.md)。后续交付应替换过时状态，不累积聊天全文。

## 分支与发布状态 / Branch and release

- 唯一正式上游：`CZL-Homelab/Visualization-of-Science-and-Engineering`。
- 当前工作分支：`improve/desalination-3d`，基于组织 `dev` 的 `7e7fec4`；海水淡化优化实现提交为 `d3cda84`。文档跟进提交为 `f2ed31a`；本轮 Logo、共享入场与主题改动及同步文档见该分支和 PR 最新 head，不将旧提交的检查结果视为新提交的检查结果。
- [PR #8](https://github.com/CZL-Homelab/Visualization-of-Science-and-Engineering/pull/8)：由 `k2316020523` 向组织 `main` 提交，包含 `dev` 的四个 Lab 与海水淡化优化，当前未合并。
- 本次核对时组织 `main` 为 `8ae3185`，仍包含两个 Lab；最近 [Pages 发布](https://github.com/CZL-Homelab/Visualization-of-Science-and-Engineering/actions/runs/41192255391) 成功且对应此提交。四个 Lab 的接入和本次优化尚未上线。
- 用户决定：保持 `k2316020523` 账号，由用户手动合并；不切换到其他账号执行合并或发布。该账号没有组织仓库直接推送/合并权限，不修改组织权限来绕过限制。

The working branch is based on organization `dev` at `7e7fec4`; implementation commit `d3cda84` improves Desalination Lab. PR #8, authored by `k2316020523`, targets organization `main` and carries the four-lab integration. It is open and unreleased. At this check, `main` and the latest successful Pages deployment remain at `8ae3185` with two labs. The user will merge manually and requires the designated account to remain active; do not switch identities or change organization permissions. Documentation follow-up is f2ed31a; the subsequent logo/shared-entrance/theme work and its documentation are identified by the latest branch/PR head and checks.

## 本轮共享体验 / Current shared experience

- 用户选择：默认“跟随系统，记住手动选择”，不按本地白天/夜晚时钟强制切换。
- Logo 简化为灰白等轴测框架与前后蓝色轨道，保留少量青/铜色点缀，16–32px 调整次要细节和线宽。
- 目录与四个 Lab 都有独立学科图形的入场，约 1.6 秒结束，支持立即跳过/顶栏回放；锚点直达、用户操作、隐藏页面及减少动态效果遵循公共规则。重型初始化后再开始计时，不影响实际模型或讲解。
- assets/theme.js 统一首次绘制前及运行时主题：实时系统跟随、手动持久化、同源同步、旧键迁移、存储禁用回退；页脚可恢复系统模式。Motor 通过挂接回调更新引擎，图表/聚变继续使用原有主题事件。
- assets/entry.js 与 entry.css 维护入场和公共控件；scripts/shared_experience.py 内嵌到所有页面。离线快照重开清理旧节点/按钮。手机 Motor 标题与目录 GitHub 链接保持单行，窄屏下载按钮保留可读名称。
- README、各项目 README/AGENTS、资源与站点/贡献指南已同步；共享主题测试加入 CI 与 Pages，站点检查核对内嵌 Logo 和入场身份。

The user chose system defaults with remembered manual overrides, not clock-based day/night rules. This round refines the logo and unifies finite subject-specific entrances, immediate skip/replay, deep links, reduced motion and cleanup. Shared theme.js handles first paint, live system changes, persistence, same-origin sync, migration, storage denial and footer automatic reset; existing engine/chart theme hooks remain connected. Shared entry.js/CSS are embedded by scripts/shared_experience.py. Download snapshots avoid duplicate controls and compact headers retain readable labels. Related READMEs, AGENTS and guides are updated; CI/Pages run the shared theme tests and site checks verify embedded identity.

## 已完成 / Completed

- 四个 Lab：Motor、Stock Market、Desalination、Fusion。项目清单、各 Lab 目录、路由和 CI/Pages 构建已在工作分支整合。
- 海水淡化 B/C/G 默认 3D：卷绕膜片与独立集水管、进水/产水/浓水水路、整厂连通管线和扩散器；增加标注、读数、暂停、缩放、复位、剖切及键盘操作。
- 修正盐水侧压力、平衡显示及自动讲解只改控件外观的问题。减少动态效果默认暂停；WebGL 不可用时可切回 2D；模块销毁释放 GPU 资源。模型为教学示意，不计算工程尺寸、排海羽流或环评。
- 文档跟进：将代码、说明、指南、AGENTS 自身和交接同步纳入交付要求；补齐四 Lab 的中英文 README、目录树、构建/测试/发布指南和 PR 模板；补充海水淡化专用 AGENTS。

The branch integrates Motor, Stock Market, Desalination and Fusion Labs. Desalination's B/C/G scenes now expose annotated, pausable 3D models, separate RO flow paths and connected plant pipes. Pressure-side and lesson-state synchronization issues are corrected; reduced motion, offline use, 2D fallback and GPU disposal are retained. Geometry remains educational. Documentation follow-up makes README, guides, AGENTS, changelog and handoff maintenance part of delivery and corrects the four-lab guidance in both languages.

## 验证与限制 / Validation and limits

实现提交 `d3cda84` 已执行：

- 四个项目构建、全部源码语法、各自模型与离线封装检查通过；海水淡化含 23 项物理检查及 `check-scenes.cjs` 的讲解到 3D 状态联动检查。
- `scripts/check_site.py` 和 `git diff --check` 通过；四个 Lab 能打开，目录覆盖清单全部项目并正确标记当前页。
- 海水淡化 B/C/G 的深浅主题、桌面与 390px 共 12 组浏览器视图检查；验证暂停/播放、键盘/复位、2D/3D 切换、渗透方向与低压停产、`file://`、WebGL 禁用回退、资源释放，无脚本错误和横向溢出。使用无头 Chrome 软件 WebGL；未验证所有物理设备/GPU、系统语音或生产页面的新版本。
- 该实现提交的 GitHub 四个 Lab × Windows/Linux 共 8 项检查全部通过。

文档提交 `f2ed31a` 已核对 21 份 Markdown 的 78 个本地链接、项目清单、命令/路径及 `git diff --check`；该提交不改变运行代码。

本轮共享体验的验证与限制（本机检查，提交号见 PR 最新 head）：

- 四个 Lab 已重新构建，公共主题行为测试、公共/项目 JS 语法及现有模型/封装检查通过；站点检查核对全部路由、目录及内嵌标识。
- 浏览器已检查目录和四个 Lab 的深浅主题、入场跳过/回放/自动结束、运行中减少动态效果；检查 390px 无横向溢出；深链、系统实时切换、跨页主题同步、存储禁用、离线快照重开无重复控件均通过。最新输入处理额外检查点击、滚轮和键盘立即跳过，不误触遮挡下的控件。最终提交的 CI 以 PR 最新 head 为准，不能沿用旧提交结果。
- 所有可视验收使用本机无头 Chrome，三维为软件 WebGL；未宣称覆盖全部浏览器、GPU 或系统语音。

Implementation commit `d3cda84` passed all four builds, source syntax and applicable model/packaging tests, site checks and eight GitHub Windows/Linux jobs. Desalination additionally passed 23 physics checks and lesson-to-3D regression checks. Browser checks covered B/C/G in two themes at desktop/390px, pause/play, keyboard/reset, 2D switching, pressure/direction changes, offline file use, disabled-WebGL fallback and GPU disposal. These used headless Chrome with software WebGL, not every hardware/GPU or system speech environment; unreleased production content was not tested.

Documentation commit f2ed31a checked 78 local links across 21 Markdown files, registry/command/path consistency and whitespace without runtime changes. This shared-experience round rebuilds all labs and runs shared theme, syntax, model/packaging and site checks. Browser coverage includes catalog/all labs in both themes, entrance skip/replay/end and runtime reduced motion; 390px headers have no horizontal overflow, and deep links, live/cross-tab themes, blocked storage and reopened offline snapshots pass. Final input checks cover immediate pointer/wheel/keyboard dismissal without activating hidden controls. Verification uses headless Chrome/software WebGL, not every browser/GPU or system speech setup. Consult the latest PR head for current CI results.

## 下一步 / Next steps

1. 用户审阅 PR #8 最新代码与文档，确认最新 head 的 CI 通过后手动合并。
2. 合并后检查组织 Pages 工作流成功，并实际打开根目录与四条 Lab 路由，确认目录、主题及新海水淡化 3D 已发布；不能只凭合并或推送宣布上线。
3. 将实际合并提交、部署记录和验证结果更新到此文件，并按发布结果整理 CHANGELOG 的 Unreleased 条目。
4. 下一位维护者开始新工作前重新核对远端、PR、账号和部署，以上状态不是实时监控。继续 `dev` 开发前核对它是否已包含本次改动，避免覆盖或重复实现。

The user reviews and manually merges PR #8 after checks pass on the latest head. Then inspect the Pages run, verify the catalog and all four live routes including the new 3D behavior, and update this handoff and the Unreleased changelog with observed release evidence. Recheck remote/PR/account/deployment state when resuming; this snapshot is not live monitoring. Check whether `dev` contains the changes before continuing development there.
