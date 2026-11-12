# Fusion Lab 协作说明 / Contributor instructions

## 中文

- 先读根目录 `AGENTS.md` 和本项目 `README.md`。修改 `src/`，运行 `python3 build.py`，将生成的 `index.html` 与源码一起提交；不要直接修改生成页或重排第三方库。
- 保持单文件离线运行，保留 Three.js MIT 署名。引用资料可链接外网，运行资源必须内嵌。
- 物理公式集中在 `src/core.js`，教学场景在 `src/content.js`。区分反应能、加热功率、聚变增益与电站净电功率；ITER 不发电。示意几何、粒子运动和脉冲不得描述为工程仿真。
- 验证命令：`node tests/check-physics.cjs`、`node tests/check-build.cjs`，以及对全部 `src/*.js` 执行 `node --check`。从仓库根目录运行 `python3 scripts/check_site.py` 和 `git diff --check`。
- 三维改动须视觉检查 Intro、a1 的反应闪光、b2 的透明线圈、b5 的截面和 c1 的人物比例及标签。检查桌面与 390px 窄屏的深浅主题、爆炸图滑块、暂停和减少动态效果；截图放临时目录，不加入发布内容。
- 保持 `czl-lab-theme`、首次绘制前的主题初始化、返回目录入口和四个实验室目录一致。更新文档时同时提供中英文。

- 入场使用根目录公共磁约束图形和跳过/回放，不替代实验台内的 Intro/开始讲解。`initTheme()` 挂接公共控制器，三维通过 `fl:theme` 更新。系统默认、手动选择和减少动态效果遵循根 AGENTS，修改时更新项目 README。

## English

- Read the root `AGENTS.md` and this project's `README.md`. Edit `src/`, run `python3 build.py`, and commit the generated `index.html` with source. Do not edit the generated page directly or reformat vendored libraries.
- Preserve standalone offline operation and the Three.js MIT attribution. References may link to the web; runtime assets must be embedded.
- Keep physics in `src/core.js` and lessons in `src/content.js`. Distinguish reaction energy, heating power, fusion gain and net electrical output. ITER does not generate electricity. Geometry, particle motion and pulses are educational illustrations, not engineering simulations.
- Run `node tests/check-physics.cjs`, `node tests/check-build.cjs`, and `node --check` for every `src/*.js` file. From the repository root, run `python3 scripts/check_site.py` and `git diff --check`.
- Visually review Intro, the a1 reaction flash, b2 ghost coils, b5 cross-section and c1 person/label after 3D changes. Check desktop and 390px layouts in both themes, the exploded-view slider, pause and reduced motion. Keep screenshots in temporary storage, outside deployment.
- Preserve `czl-lab-theme`, theme initialization before first paint, catalog navigation and the four-lab directories. Keep documentation bilingual.

- The shared magnetic-confinement entrance and skip/replay are separate from the stage Intro/tour controls. initTheme mounts the shared controller; the 3D world updates on fl:theme. Follow root AGENTS for system defaults, manual choices and reduced motion, updating the project README when changed.
