# Motor Lab 开发说明

同时遵循仓库根目录 `AGENTS.md`。本目录为电机原理实验室源码，先阅读 `README.md` 中的教学边界。

## 维护入口

- `src/page.html`：主页面模板；`course.html`、`parts.html`：嵌入模板。
- `src/lab.css`：实验台、字幕、入场动画和同步对比样式。
- `src/core.js`：六种电机数据、旧课程、波形、工作点与损耗账本。
- `src/courses.js`：每种电机八幕课程、零件说明、检验题。
- `src/engine.js`：Three.js 几何、材质、标签、相机和部件动画。
- `src/app.js`：主实验台控制、语音、同步原理小图。
- `src/director.js`：自动导演、画内字幕、四组双三维对比。
- `index.html` 由 `build.py` 生成，不能作为唯一修改入口。

脚本按构建文件中的固定顺序内嵌，存在共享的 `state`、`teaching` 及函数引用。调整顺序前检查依赖。双模型通过 `motorContext(snapshot, fn)` 临时切换状态并在 `finally` 恢复；不要让对比渲染污染主实验台。每个 `MotorScene` 必须使用自身标签容器。

## 行为和物理约束

- 默认进入完整运行动效，再进行八幕自动讲解与后续机型轮播。显式暂停或手动操作应优先于自动导演。
- PMSM A/B/C 保持固定相色，明暗表示电流绝对值，符号和亮点表达方向；桥图明暗不代表实际 PWM 瞬时开关。
- 同步转子同平均转速但可有磁轴夹角；感应转子的转差是速度差，不能画成固定落后角。
- 鼠笼必须有导条和两端短路环；有刷电机碳刷固定、换向器随轴转；罩极铜环闭合且只包住部分磁极。
- 保持电容运转与电容启动的区别。罩极局部时序不能替换为理想圆形三相场。
- 任何新转矩、温升或效率结果必须说明计算模型；不要从示意亮度推导实测结论。

## 检查

在本目录运行：

```sh
python build.py
node --check src/core.js
node --check src/courses.js
node --check src/engine.js
node --check src/app.js
node --check src/director.js
node tests/check-model.cjs
```

改动交互时检查六种默认运行状态、课程步骤、暂停/步进、零件隔离、四组同步对比和窄屏溢出。自动导演的改动额外检查从全景进入课程、最后一幕进入下一种电机及手动接管。不要声称测试了未实际运行的语音包、文件协议或浏览器。

此项目不需要 npm 依赖安装。固定 Three.js UMD 构建保留单文件 `file://` 可用性；库的弃用提示本身不是构建失败，不要仅为消除提示就破坏离线封装。

## English — Motor Lab development instructions

Follow the repository AGENTS.md and read the README's model boundaries first.

Source map: page.html is the main template; course.html and parts.html are embedded templates; lab.css styles the lab, captions, entry and comparisons. core.js contains motor data, older lessons, waveforms and operating points. courses.js defines 48 scenes, part explanations and quizzes. engine.js manages geometry, materials, labels, camera and motion. app.js connects controls, speech and diagrams. director.js manages tours, captions and synchronized comparisons. build.py generates index.html; never make the generated file the only edit target.

Scripts use a fixed embedded order with shared state, teaching and functions. Check dependencies before changing it. Comparison scenes temporarily switch state via motorContext(snapshot, fn) and restore it in finally. Do not leak comparison state into the main lab. Each MotorScene owns its label container.

Default entry is a running showcase followed by eight-scene tours and the motor playlist. Explicit pause/manual input overrides the director. PMSM phase colors remain stable; brightness represents absolute current and signs/particles represent direction, not instantaneous PWM switch states. Synchronous speed with a fixed magnetic-axis angle differs from induction slip. Cage bars require both end rings. Brushes remain fixed while the commutator rotates. Shading rings must be closed and enclose only part of a pole. Distinguish capacitor-run from capacitor-start designs; do not replace local shaded-pole timing with an ideal circular field.

Disclose any new torque, temperature or efficiency model. Do not infer measured quantities from illustrative brightness. Run the build, all JavaScript syntax checks and node tests/check-model.cjs using the commands above. For UI changes check all six default states, lessons, pause/step, isolation, four comparison groups and narrow layouts. Director changes also require showcase-to-tour, last-scene-to-next-motor and manual takeover checks. Report speech-package, file-protocol and browser verification limits honestly.

No npm installation is required. Keep the fixed Three.js UMD build and its license for standalone file:// compatibility; its deprecation notice alone is not a build failure. The shared icon is read from ../../assets/icon.svg and embedded by the build; do not replace it with a runtime request. The external directory and repository links intentionally require connectivity.
