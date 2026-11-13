# 当前交接 / Current handoff

核对日期 / Checked: **2026-11-13（Asia/Shanghai）**。此文件是可更新的当前状态摘要；历史功能变更见 [CHANGELOG](../CHANGELOG.md)，长期协作规则见 [AGENTS](../AGENTS.md)，构建与提交流程见 [CONTRIBUTING](../CONTRIBUTING.md)。后续交付应替换过时状态，不累积聊天全文。

## 分支与发布状态 / Branch and release

- 唯一正式上游：`CZL-Homelab/Visualization-of-Science-and-Engineering`。
- [PR #9](https://github.com/CZL-Homelab/Visualization-of-Science-and-Engineering/pull/9)（仿星器）已合并，组织 `main` 为 `94f1ed7`，包含 Motor、Stock Market、Desalination、Fusion 四个 Lab 与共享入场/主题。本次没有核对该提交的 Pages 运行结果和线上页面。
- 当前工作分支：`feat/add-distillation-lab`，基于 `main` 的 `94f1ed7`，新增第五个实验室 Distillation Lab 并接入目录、公共入场与 CI/Pages。由用户账号通过 GitHub Desktop 推送并向 `main` 开 PR；尚未合并或上线，CI 以 PR 最新 head 为准。
- 用户决定：PR 包含精馏实验室及必要的站点接入（项目清单、其他四个 Lab 的目录卡片、公共入场图形、CI/Pages、文档）；合并与发布由维护者决定。不修改组织权限或分支保护。

PR #9 (stellarator) is merged; organization `main` is at `94f1ed7` with the Motor, Stock Market, Desalination and Fusion labs and the shared entrance/theme. Its Pages run and live pages were not checked here. The working branch `feat/add-distillation-lab`, based on `94f1ed7`, adds the fifth lab, Distillation Lab, and integrates it with the catalog, shared entrance and CI/Pages. It is pushed from the user's account through GitHub Desktop as a PR to `main`; it is neither merged nor deployed, and CI should be read from the PR's latest head. The user chose to include the lab plus the required site integration (registry, a fifth card in the other four labs' directories, the shared entrance motif, CI/Pages and documentation); merging and release stay with the maintainers. Do not change organization permissions or branch protection.

## 精馏实验室 / Distillation Lab

- `Projects/distillation-lab`：10 个模块、73 幕讲解、9 组同步对比，单文件离线。热力学集中在 `src/thermo.js`（Antoine、Raoult / NRTL / van Laar、泡点、闪蒸、Rayleigh、McCabe–Thiele、Rmin、FUG、间歇、水蒸气蒸馏、TBP、操作型逐级计算）。
- `src/aspen.js` 收录用户用 Aspen Plus V15（中文界面，NRTL，APV150）导出的数据：10 组 NRTL 二元参数、乙醇–水 20/101.325/500/1000 kPa T–x–y（含 γ）、苯–甲苯 16 级 RadFrac 基准塔（第 8 级进料、R 1.9、D/F 0.45、IDEAL）。用户已确认 `ETHYL-01` 为乙二醇、RadFrac 使用 IDEAL。对照结果：γ 相对误差 < 1e-5，泡点 ≤ 0.21 °C，|Δy| ≤ 0.0024，恒沸组成 < 0.008；RadFrac 逐级组成 ≤ 0.025、温度 ≤ 0.6 °C，再沸蒸汽 Aspen 123.5 vs 恒摩尔流 130.5 kmol/h。
- 已知边界：乙醇–水在约 9 kPa 以下恒沸点消失不能保证再现；萃取精馏假定萃取段溶剂分数恒定；非均相共沸只画流程；原油 TBP、成本曲线、塔板操作窗口为示意。
- 接入：`site/projects.json` 与 `assets/distillation-preview.svg`；`scripts/shared_experience.py` 配置 `distillation-lab`（事件 `distl:theme`），`assets/entry.js` 增加精馏塔入场图形；其余四个 Lab 的目录加第五张卡片并重建；新增 `.github/workflows/distillation-lab.yml`，`pages.yml` 增加构建步骤。
- 验证（本机，针对本分支）：五个 Lab 全部重建；`scripts/check-theme.cjs`、公共与各项目 JS 语法、Motor/Stock/Desalination/Fusion 原有检查、精馏 37 项热力学 + 12 项封装检查、`scripts/build_site.py`、`scripts/check_site.py`、`git diff --check` 通过。无头 Chrome 检查：精馏入场出现并自动结束、跳过与顶栏回放、减少动态效果下不播放且回放禁用、主题手动切换写入 `czl-lab-theme` 并同步 `theme-color`、页脚“跟随系统”清除选择；目录页与五个 Lab 在深浅主题、1440 与 390px 下目录均为 5 张卡片并标记当前页，无横向溢出、无脚本错误；精馏实验室随机操作压力测试 0 问题。其他四个 Lab 只改了目录卡片，未重测其模型交互；未在真实 GPU、其他浏览器或触屏设备上检查。
- 用户决定：本项目为纯科普，不要测验和提问。已删除 10 个模块的全部自测题（31 道）、页面“理解检验”区块与相关样式，5 处设问式标题/提示改为陈述句；`check-build.cjs` 改为检查不含 quiz（12 项）。
- 用户反馈待办：把泡点/露点、相对挥发度讲透；课程顺序改为由简单蒸馏逐步引到精馏。

`Projects/distillation-lab` adds ten modules, 73 scenes and nine synchronized comparisons, all offline, with thermodynamics in `src/thermo.js`. `src/aspen.js` bundles the user's Aspen Plus V15 exports (ten NRTL sets, ethanol–water T–x–y at four pressures with γ, a 16-stage benzene–toluene RadFrac column, IDEAL); the user confirmed `ETHYL-01` is ethylene glycol and that RadFrac used IDEAL. The page matches Aspen's γ within 1e-5, bubble points within 0.21 °C, azeotropes within 0.008 and the RadFrac profile within 0.025 in x and 0.6 °C. Limits: the disappearance of the ethanol–water azeotrope below about 9 kPa is not guaranteed, extractive distillation assumes a constant solvent fraction, heterogeneous azeotropic distillation is a flowsheet only, and crude TBP, cost and tray-window curves are illustrative. Integration covers the registry, preview, shared entrance motif, a fifth directory card in the other labs, a new CI workflow and a Pages step. Local checks on this branch: all five labs rebuilt; shared theme test, script syntax, the existing Motor/Stock/Desalination/Fusion checks, 37 distillation thermodynamic checks plus 12 packaging checks, site build/check and git diff --check pass. Headless Chrome covered the distillation entrance (auto-dismiss, skip, replay, reduced motion), manual theme persistence and footer reset, five directory cards with the current page marked in the catalog and every lab in both themes at 1440 and 390 px without overflow or script errors, and a random stress run of the lab with zero issues. The other labs' runtime code is unchanged apart from the directory card and was not retested; real GPUs, other browsers and touch devices were not checked. The user wants a pure popular-science lab without tests or questions: all 31 module quiz questions, the page's check section and its styles are removed, five question-style titles/guides now read as statements, and `check-build.cjs` (12 checks) rejects quiz data. Pending user feedback: explain bubble/dew points and relative volatility more thoroughly, and reorder the course from simple distillation towards rectification.

## 仿星器 / Stellarator (Fusion Lab b6)

- 第 02 章新增 b6「另一种拧法：仿星器」，全课 42 幕。新增 `src/stellarator.js`（磁面、磁力线、50 + 20 个线圈、标注锚点）和 `stellarator` 仪器面板（ι 滑块、线圈剖开/全部/隐藏、托卡马克对照表、W7-X 数字）。`app.js` 的舞台从“微观 / 装置”两套扩展为三套，切换时淡入淡出。
- 物理放在 `core.js`：旋转椭圆磁面、螺旋磁轴、磁力线角度；`check-physics.cjs` 增至 44 项，新增场周期性、仿星器对称性、磁力线平均旋转变换三类不变量。
- Wendelstein 7-X 的数字于 2026-11-13 对照 IPP 官方页面核对：50 个非平面 + 20 个平面线圈、5 个模块、大半径 5.5 m、小半径 0.53 m、30 m³、3 T；2025 年 OP 2.3 的 1.8 GJ / 360 s 与三重积高值维持 43 s。IPP 页面上没有查到 ι 的取值范围和超导材料，所以页面没有写这两项，滑块范围标为示意值。2025 年 6 月之后的新纪录没有核对。
- 明确的简化：磁面与线圈是示意几何，只借用 W7-X 的线圈和模块数量；小半径放大约 1.7 倍；正面扇区的线圈默认剖开。页面的角标、幕内说明、仪器注释、模型边界和 README 都写了这一点。
- 验证（本机，针对本分支的构建）：Fusion 构建、44 项物理检查、封装检查、全部 `src/*.js` 语法、`scripts/check-theme.cjs`、`scripts/check_site.py`、`git diff --check` 通过。无头 Chrome（软件 WebGL）按真实时间驱动检查了 b5 → b6 → c1 → b6 的转场、深浅主题、桌面与 390px（无横向溢出）、三种线圈显示及对应标注、ι 滑块接管自动讲解、暂停动效后时钟停止、减少动态效果下默认暂停，无脚本错误。没有在真实 GPU、其他浏览器或触屏设备上检查；其余三个 Lab 的运行代码没有改动，没有重测。

Scene b6 adds a stellarator to chapter 02 (42 scenes). `src/stellarator.js` builds the surfaces, field lines, 50 + 20 coils and label anchors; a `stellarator` instrument offers the ι slider, cut / all / hidden coils, a tokamak comparison and W7-X figures. `app.js` now switches between three stage worlds with a fade. The schematic surface lives in `core.js`, and the physics checks grow to 44 with field periodicity, stellarator symmetry and mean field-line winding. W7-X figures were checked against IPP pages on 2026-11-13; the ι range and superconductor were not found there and are therefore not stated, and results after June 2025 were not checked. Surfaces and coils are schematic, the minor radius is drawn about 1.7× too large and the front coils are cut away by default; the page and documentation say so. Local checks on this branch passed: build, 44 physics checks, packaging, syntax, shared theme, site check and whitespace. Headless Chrome with software WebGL, driven in real time, covered the b5 → b6 → c1 → b6 transitions, both themes, desktop and 390px without overflow, the three coil views and their labels, slider takeover, pause and reduced motion, with no script errors. Real GPUs, other browsers and touch devices were not checked, and the other three labs were not retested because their runtime code is unchanged.

## 本轮共享体验 / Current shared experience

- 用户选择：默认“跟随系统，记住手动选择”，不按本地白天/夜晚时钟强制切换。
- Logo 简化为灰白等轴测框架与前后蓝色轨道，保留少量青/铜色点缀，16–32px 调整次要细节和线宽。
- 目录与四个 Lab 都有独立学科图形的入场，约 1.6 秒结束，支持立即跳过/顶栏回放；锚点直达、用户操作、隐藏页面及减少动态效果遵循公共规则。重型初始化后再开始计时，不影响实际模型或讲解。
- assets/theme.js 统一首次绘制前及运行时主题：实时系统跟随、手动持久化、同源同步、旧键迁移、存储禁用回退；页脚可恢复系统模式。Motor 通过挂接回调更新引擎，图表/聚变继续使用原有主题事件。
- assets/entry.js 与 entry.css 维护入场和公共控件；scripts/shared_experience.py 内嵌到所有页面。离线快照重开清理旧节点/按钮。手机 Motor 标题与目录 GitHub 链接保持单行，窄屏下载按钮保留可读名称。
- README、各项目 README/AGENTS、资源与站点/贡献指南已同步；共享主题测试加入 CI 与 Pages，站点检查核对内嵌 Logo 和入场身份。

The user chose system defaults with remembered manual overrides, not clock-based day/night rules. This round refines the logo and unifies finite subject-specific entrances, immediate skip/replay, deep links, reduced motion and cleanup. Shared theme.js handles first paint, live system changes, persistence, same-origin sync, migration, storage denial and footer automatic reset; existing engine/chart theme hooks remain connected. Shared entry.js/CSS are embedded by scripts/shared_experience.py. Download snapshots avoid duplicate controls and compact headers retain readable labels. Related READMEs, AGENTS and guides are updated; CI/Pages run the shared theme tests and site checks verify embedded identity.

## 已完成 / Completed

- 五个 Lab：Motor、Stock Market、Desalination、Fusion，以及本分支新增的 Distillation。项目清单、各 Lab 目录、路由和 CI/Pages 构建已整合。
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

1. 用户审阅 PR #9，确认最新 head 的 CI 通过后决定是否合并。
2. 合并后检查组织 Pages 工作流，并实际打开根目录和 `fusion-lab/#b6`，确认新一幕已发布；同时补上 PR #8 合并后尚未做的线上核对（四条 Lab 路由、主题、海水淡化 3D）。不能只凭合并或推送宣布上线。
3. 将实际合并提交、部署记录和验证结果更新到此文件，并按发布结果整理 CHANGELOG 的 Unreleased 条目。
4. 下一位维护者开始新工作前重新核对远端、PR、账号和部署，以上状态不是实时监控。本地旧分支 `feat/fusion-lab` 已随 PR #7 合并，不要在其上继续开发。

The user reviews PR #9 and decides on the merge once checks pass on its latest head. After merging, inspect the Pages run and open the catalog and `fusion-lab/#b6`, and also perform the live check still outstanding from PR #8 (all four lab routes, themes and the Desalination 3D views). Then record the merge commit, deployment and observed results here and tidy the Unreleased changelog entries. Recheck remote, PR, account and deployment state when resuming; this snapshot is not live monitoring. The old local branch `feat/fusion-lab` was merged with PR #7 and should not be developed further.
