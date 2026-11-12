# 更新记录 / Changelog

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
