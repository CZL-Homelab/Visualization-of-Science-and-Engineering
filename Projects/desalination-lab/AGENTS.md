# 海水淡化实验室协作约定 / Desalination Lab contributor guidance

## 中文

先读根 [AGENTS.md](../../AGENTS.md)、[交接记录](../../docs/HANDOFF.md) 和本项目 [README](README.md)。遵守根目录的文档同步要求：功能、模型、交互、源码入口或检查改变时，同步项目 README、适用的根文档、本文件及交接记录；用户可见变更写入未发布更新记录。

- 修改 `src/`，运行 `python build.py`，将生成的 `index.html` 与源码一起提交。保留离线 Three.js 和 `vendor/THREE-LICENSE.txt`，不引入远程运行资源。
- `core.js` 是物理计算入口，`simulations.js` 组装模型状态，`modules/` 定义七个模块与场景，`three-views.js` 维护 B/C/G 三维视图；`charts.js`、`ui.js` 和 `app.js` 分别负责图表、控件与讲解/导航；`initTheme()` 挂接根目录公共主题控制器并使用 `dl:theme` 重绘。
- 区分进水、产水和浓水的流量/盐度；保持水与盐质量守恒。渗透装置的外加压力作用在盐水侧，滑块米数是等效淡水柱压头；不能描述为淡水侧自动升起的水柱。
- RO 使用卷绕膜片与独立中心集水管，区分轴向进水/浓水和穿膜后的产水路径。几何层间距、管线、粒子和厂区为教学示意，不声称计算了膜内流场、工程设备尺寸或排海羽流/环评。
- 讲解场景的参数补丁必须更新真实模型状态，不能只改变控件外观；同步检查读数、2D 和 3D。压力不足时 3D 不显示继续产水。
- 保留暂停、镜头复位、缩放、拖动/键盘控制、RO 剖切和 2D 回退；减少动态效果默认暂停。切换模块释放几何、材质与纹理，隐藏时不继续渲染。
- 验证：对 `src/*.js` 与 `src/modules/*.js` 执行 `node --check`，运行 `node tests/check-physics.cjs`、`node tests/check-scenes.cjs`、`node tests/check-build.cjs`；根目录运行 `python scripts/check_site.py` 和 `git diff --check`。
- 3D 改动必须视觉检查 B/C/G 深浅主题、桌面与 390px、标注/遮挡、方向与压力状态、暂停/播放和镜头控制；按影响范围验证 `file://`、WebGL 禁用回退和销毁。报告实际执行及未执行的环境，截图放临时目录。

## English

Read the root [AGENTS](../../AGENTS.md), [handoff](../../docs/HANDOFF.md) and project [README](README.md). Follow the root documentation-delivery rules: keep project README, affected root guides, this file and handoff consistent when features, models, interactions, entry points or checks change. Record user-visible changes as unreleased until release is verified.

- Edit `src/`, run `python build.py`, and commit generated `index.html` with source. Preserve the offline Three.js build and its license; add no remote runtime assets.
- `core.js` owns physics; `simulations.js` composes model state; `modules/` defines the seven modules/lessons; `three-views.js` owns B/C/G scenes. Charts, controls and application/director/navigation live in charts.js, ui.js and app.js respectively. initTheme mounts the root shared controller; charts redraw on dl:theme.
- Distinguish feed, product and brine flows/concentrations and conserve water and salt. Applied osmosis pressure acts on the saline side; metres express an equivalent freshwater pressure head, not a rising freshwater-side column.
- Keep wound RO sheets and a separate product collection tube, distinguishing axial feed/brine flow from permeate collection. Geometry, paths, particles and plant layout are teaching illustrations, not computed membrane hydraulics, equipment sizing or environmental discharge results.
- Lesson patches must change actual model state as well as controls; verify readouts, 2D and 3D together. Insufficient pressure must not animate continued product flow.
- Preserve pause/reset/zoom, drag/keyboard controls, the RO cutaway and 2D fallback. Reduced motion starts paused. Release geometry/material/texture resources on module teardown and avoid rendering hidden views.
- Check all `src/*.js` and `src/modules/*.js` with `node --check`; run `check-physics.cjs`, `check-scenes.cjs` and `check-build.cjs` under `tests/`. From the root run `python scripts/check_site.py` and `git diff --check`.
- Visually check B/C/G in both themes at desktop and 390px after 3D changes, including annotations/occlusion, direction/pressure, pause/play and camera controls. Check file use, disabled-WebGL fallback and disposal as affected. Report tested and untested environments honestly; keep screenshots outside deployment.

入场使用公共膜分离图形及跳过/回放控制；减少动态效果、系统主题默认与手动偏好按根 AGENTS，变更同步项目 README。

The shared entrance uses the membrane motif and skip/replay controls. Follow root AGENTS for reduced motion, system defaults and manual theme choices; update the project README for changes.
