# 更新记录 / Changelog

## Engine Lab · 四冲程发动机原理实验室

- 新增第三个实验室：8 个模块、39 幕讲解、8 组随堂测验，纯 Canvas 2D 单文件离线运行。
- 模型层 `src/core.js` 为纯函数：曲柄-连杆运动学、配气相位（含叠开与 IVC/EVC）、γ=1.3 压力模型、点火提前角效应、四缸相位与 1-3-4-2 点火顺序；`tests/check-model.cjs` 26 项断言全部针对物理量本身。
- 仪器：正时条、升程曲线、凸轮轴 2:1 齿轮、P-V 示功图（环面积 = 净功）、压缩比实验台、功率-提前角曲线、汽油/柴油双模型同步对照、四缸点火脉冲条。
- 两个既有实验室的目录与 `site/projects.json` 同步登记 Engine Lab，目录网格改为自适应三列。

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
