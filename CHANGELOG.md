# 更新记录 / Changelog

## 未发布 / Unreleased · 2026-11-13 · 新增 Distillation Lab 精馏原理实验室

- 新增第五个离线实验室 `Projects/distillation-lab`：10 个模块、73 幕自动讲解，覆盖气液平衡、闪蒸与简单蒸馏、McCabe–Thiele 连续精馏、回流比与能耗（FUG 简捷法）、间歇精馏、共沸/变压/萃取/非均相共沸精馏、减压与水蒸气蒸馏、塔板与填料效率、原油常压蒸馏与 9 组同步对比。
- 温度与组成由 Antoine 常数、Raoult / NRTL / van Laar 模型与恒摩尔流现算；物性表列出模型沸点与文献值。收录项目维护者从 Aspen Plus V15（APV150）导出的 NRTL 参数、乙醇–水 20/101.325/500/1000 kPa T–x–y 和苯–甲苯 RadFrac 基准塔，页面逐项对照（泡点 ≤ 0.21 °C、恒沸组成 < 0.008、逐级组成 ≤ 0.025）。
- `tests/check-thermo.cjs` 锁定 37 条热力学、塔计算与 Aspen 对照不变量，`tests/check-build.cjs` 检查离线封装、公共主题/入场与按 `site/projects.json` 覆盖的实验室目录；新增 `distillation-lab.yml`（Windows/Linux）与 Pages 构建步骤。
- 接入站点：登记 `site/projects.json` 与预览图 `assets/distillation-preview.svg`，`scripts/shared_experience.py` 与 `assets/entry.js` 增加精馏塔入场图形，其余四个实验室目录增加第五张卡片（“四个”→“五个”）；根 README、贡献指南、资源说明、AGENTS 与交接同步更新。

English: Add the fifth offline lab, `Projects/distillation-lab`: ten modules and 73 guided scenes on vapour–liquid equilibrium, flash and simple distillation, McCabe–Thiele columns, reflux and energy (FUG shortcut), batch, azeotropic/pressure-swing/extractive/heterogeneous distillation, vacuum and steam distillation, tray and packing efficiency, crude-oil fractionation and nine synchronized comparisons. Temperatures and compositions are computed live from Antoine constants, Raoult/NRTL/van Laar and constant molar overflow. Reference data exported by the maintainer from Aspen Plus V15 (APV150 NRTL parameters, ethanol–water T–x–y at four pressures, a benzene–toluene RadFrac column) is bundled and compared on the page. 37 thermodynamic/Aspen checks and a packaging test that follows `site/projects.json` run in a new Windows/Linux workflow and in Pages. The lab is registered in the catalog with a preview, gets a tray-column entrance in the shared assets, and the other four labs' directories gain a fifth card; root and contributor documentation and the handoff are updated.

## 未发布 / Unreleased · 2026-11-13 · Fusion Lab 增加仿星器一幕

- 第 02 章“磁约束”新增 b6「另一种拧法：仿星器」，全课变为 42 幕：旋转椭圆磁面、可调旋转变换 ι 的磁力线、50 个非平面与 20 个平面线圈（剖开 / 全部 / 隐藏），以及托卡马克与仿星器对照表。
- `core.js` 新增示意磁面与磁力线角度函数；物理检查增至 44 项，覆盖场周期性、仿星器对称性和磁力线平均旋转变换。
- Wendelstein 7-X 的参数与 2025 年长脉冲纪录按 IPP 官方页面核对并写入数字口径；页面、README 与模型边界写明磁面和线圈是示意几何，不是真实位形。

English: Add scene b6, a stellarator, to the confinement chapter (42 scenes in total): rotating-ellipse flux surfaces, field lines with an adjustable rotational transform, 50 non-planar and 20 planar coils with cut / all / hidden views, and a tokamak–stellarator comparison. `core.js` gains the schematic surface functions and the physics checks grow to 44, covering field periodicity, stellarator symmetry and the mean winding of a field line. Wendelstein 7-X figures and its 2025 long-pulse records are sourced from IPP; the page and documentation state that the surfaces and coils are schematic, not the real configuration.

## 未发布 / Unreleased · 2026-11-13

- 全站品牌与体验：优化共享 SVG Logo 的灰白空间框架、前后轨道和 16–32px 细节。目录与四个 Lab 统一有限入场、立即跳过、顶栏回放、深链直达和减少动态效果，内嵌公共资源保持离线使用。
- 统一首次绘制前与运行时主题控制：默认跟随系统并实时响应，持久化手动选择、跨同源页面同步、页脚恢复自动；存储禁用时仍可使用。修正手机顶栏标题/链接换行，以及下载页面重开时临时节点与按钮重复问题。

以下内容位于 [PR #8](https://github.com/CZL-Homelab/Visualization-of-Science-and-Engineering/pull/8) 的工作分支，尚未合并或部署；当前状态见 [交接记录](docs/HANDOFF.md)。

- 接入四个 Lab 的目录与构建流程；海水淡化 B/C/G 默认进入带标注和读数的 3D，保留 2D，增加暂停、镜头复位/缩放、键盘与 RO 剖切操作。
- 用卷绕膜片和独立集水管区分 RO 的进水、产水、浓水路径，整厂管线与浓盐水扩散器连通。修正盐水侧外加压力、平衡显示与讲解参数只改变控件外观的问题；物理检查增至 23 项，并加入讲解到 3D 的状态回归检查。
- 补充 GPU 资源销毁、减少动态效果默认暂停和 WebGL 不可用时的 2D 回退检查；Pages 发布前检查全部路由与各 Lab 目录。
- 将 README、指南、AGENTS.md 自身、更新记录和交接维护列为交付要求；补齐四 Lab 中英文介绍、目录树、构建/测试/发布说明和资产清单，修正海水淡化本地预览地址，新增项目专用 AGENTS 与统一交接文件。

English: Refine the shared SVG logo and small-size geometry. Unify finite subject-specific entrances, immediate skip, replay, deep links and reduced motion across catalog/all labs. Consolidate pre-paint/runtime themes with live system defaults, manual persistence, same-origin sync, automatic reset and denied-storage fallback. Keep resources inlined offline; fix compact headers and duplicate controls in reopened downloads. These changes remain on PR #8 and are not yet merged or deployed. Integrate the four-lab catalog/builds and improve Desalination B/C/G with annotated, pausable 3D, camera/keyboard/cutaway controls and a 2D alternative. Separate wound RO sheets and product collection paths, connect plant/brine piping, and correct pressure-side, equilibrium and lesson-state synchronization. Add physics/scene regressions and verify offline, fallback, reduced-motion and resource-disposal behavior. Make READMEs, guides, AGENTS itself, CHANGELOG and handoff part of delivery; correct bilingual four-lab instructions, asset inventory and preview paths, and add Desalination contributor guidance. See the handoff for current release state.

## 2026-11-12 · Fusion Lab 核聚变反应堆实验室

- 新增第四个离线实验室：7 章、41 幕，涵盖氘氚反应、磁约束、ITER 解剖、放电脉冲、能量账本、氚循环与聚变电站；明确教学近似和 ITER 不发电的边界。
- 补齐 28 项物理守恒检查、离线封装测试、双语 README/AGENTS、预览图、项目注册、四个实验室目录及 CI/Pages 构建步骤。
- 缩小反应闪光、淡化 b2 的 TF 线圈、拉远 b5 和解剖镜头、降低截面发光；爆炸图显示整数百分比，人物比例标签纳入取景，减轻首页标题渐变遮挡。

English: Add the fourth offline lab with seven chapters and 41 scenes covering D–T fusion, confinement, ITER anatomy, pulse operation, power accounting, tritium inventories and plants. Include 28 physics/conservation checks, packaging tests, bilingual contributor documentation, a catalog preview, cross-lab navigation and CI/Pages integration. Reduce the reaction flash and ghost-coil opacity, widen the cross-section/anatomy views, lower cross-section glow, show integer explosion percentages, frame the scale person and lighten the intro overlay. Models disclose educational simplifications; ITER does not generate electricity.

## 2026-11-12 · Desalination Lab 海水淡化原理实验室

- 新增第三个实验室：7 个模块（含盐阶梯、渗透压、单段 RO、MSF/MED、膜与污染、能耗口径、整厂流程），25 幕自动讲解，单文件离线运行。
- `src/core.js` 集中物理数学（van 't Hoff 渗透压、质量守恒、RO 能耗与通量、GEA 相关性、污染衰减、再矿化），`tests/check-physics.cjs` 锁定 21 项物理不变量与文献锚点（海水 π ≈ 26–28 bar、50% 回收率最小分离功 1.06 kWh/m³ 等）。
- 口径页 `src/reference.js` 记录核对日期（2026-11-10）与来源（USGS、WHO、EPA、IDA、UF/IFAS、最小分离功论文）。
- 登记 `site/projects.json`，更新根 README 与 Motor/Stock 两份实验室目录（“两个”→“三个”），Pages 工作流加入 Desalination Lab 构建与验证步骤，新增 `desalination-lab.yml` PR CI（Windows/Linux 双矩阵）。
- 动效与 3D 表现力：`src/charts.js` 升级为共享 rAF 动画层（屏幕内才重绘、路径流动粒子、条形/仪表缓动过渡，遵循 `prefers-reduced-motion`）；新增 `src/three-views.js`，B/C/G 三个模块加入可拖拽旋转、滚轮缩放的 WebGL 3D 视图（渗透装置、卷式膜元件、厂区巡览），复用 Motor Lab 同源的 vendored three.js（r160，MIT），2D 剖面保留为默认视图，WebGL 不可用时自动回退。

## 2026-10-31 · 全局主题与实验室导航

- 根目录页、Motor Lab 与 Stock Market Lab 共用 `czl-lab-theme` 深浅色偏好，默认跟随系统，并在首次绘制前应用。
- 两个实验室顶栏新增 `Lab Projects` 返回入口，页脚前新增实验室目录；主题、返回与目录均写入 README/AGENTS/CONTRIBUTING。
- Motor Lab 三维网格与坐标轴随主题调整；Stock Lab 图表沿用 `sm:theme` 重绘。
- 两个实验室增加滚动后的“↑ 顶部”按钮，遵循减少动态效果设置。
- 补充浅色对比度、焦点环与 390px 窄屏布局检查。
- 发布 Stock Market Lab 的说明与目录卡片（此前已随 PR #2 上线）。


## 项目目录与共享标识

- 根地址改为可搜索的项目目录，保留 Motor Lab 路由。
- SVG 标识统一用于 README、目录页及 Motor Lab 网页图标。
- 添加完整仓库入口、Topics 和双语协作文档。

## 2026-10-29 · 组织协作与发布

- 主仓库和后续同步目标统一到 CZL-Homelab。
- 在组织 GitHub Pages 发布 Motor Lab。
- 增加仓库 README、AI 工作说明、贡献指南、问题/PR 模板和跨平台 CI。
- 明确源码、离线生成页、第三方许可和多项目路由的维护方式。

## Motor Lab v3.1 · 2026-10-29

- 六类电机默认展示运行全景，随后自动进行八幕讲解、运镜和字幕，再轮播其他机型。
- 相电流明暗与动态原理小图。
- 四组双三维对比，共 24 幕，同区域比较电流、磁场、转子与负载。
- 增加主题入场动画，保留暂停和减少动态效果支持。

## Motor Lab v3.0 · 2026-10-29

- WebGL 程序模型、精细零件、爆炸分解、剖面、透视与零件隔离。
- 48 幕课程、理解检验题、物理不变量检查及单文件离线构建。

## English — change history

### 2026-10-31 — global theme and lab navigation

- The catalog, Motor Lab and Stock Market Lab share the `czl-lab-theme` preference, default to the system setting and apply it before first paint.
- Both labs gained a `Lab Projects` header link and a pre-footer lab directory; theme, back-link and directory rules are documented in README/AGENTS/CONTRIBUTING.
- The Motor Lab 3D grid and axes follow the theme; Stock Lab charts continue to redraw on `sm:theme`.
- Added a floating “top” button to both labs that respects reduced-motion settings.
- Added light-mode contrast, focus and 390px layout checks.
- Published the Stock Market Lab documentation and catalog card (the lab itself shipped in PR #2).


### Project directory and shared identity

- Replaced the root redirect with a searchable project catalog and retained Motor Lab's route.
- Added an original SVG identity to the README, directory and embedded Motor Lab favicon.
- Added explicit GitHub repository links, descriptive repository Topics and bilingual contributor documentation.

### 2026-10-29 — organization collaboration

- Established CZL-Homelab as the canonical repository and Pages host.
- Added repository and AI guidance, contribution documentation, Issue/PR templates and cross-platform CI.
- Documented source/generated artifacts, third-party licensing and multi-project routing.

### Motor Lab v3.1 — 2026-10-29

- Default running showcase, followed by eight guided scenes, camera direction, captions and a motor playlist.
- Current-dependent phase brightness, animated diagrams, four synchronized model comparisons with 24 scenes, and a thematic entrance animation.
- Retained pause controls and reduced-motion support.

### Motor Lab v3.0 — 2026-10-29

- Procedural WebGL models, detailed parts, exploded/cutaway/X-ray modes and part isolation.
- 48 lesson scenes, understanding checks, physical-invariant checks and single-file offline builds.
