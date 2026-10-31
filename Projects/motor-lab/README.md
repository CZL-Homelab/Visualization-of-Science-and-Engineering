# Motor Lab · v3.1 自动演示与同步对比

主仓库：[CZL-Homelab/Visualization-of-Science-and-Engineering](https://github.com/CZL-Homelab/Visualization-of-Science-and-Engineering)。
正式网站：[Motor Lab](https://czl-homelab.github.io/Visualization-of-Science-and-Engineering/motor-lab/)。

源码位于仓库的 `Projects/motor-lab/`。当前维护机目录为 `F:\ProjectA\Visualization-of-Science-and-Engineering\Projects\motor-lab`，其他开发者可克隆到任意路径。协作请先读根目录 [贡献指南](../../CONTRIBUTING.md) 和本目录 [AGENTS.md](AGENTS.md)。

## v3.1

- 六类电机默认进入完整运行动画；12 秒后自动从第一幕开始，八幕结束后轮播下一类。
- 自动讲解中连续展示运动、拆解、运镜、部件强调及画内字幕，可随时暂停或手动选择。
- PMSM 三相按固定 A/B/C 颜色，以明暗表示电流绝对值，符号和亮点表示方向；桥图明暗不表示瞬时 PWM 开关状态。
- 第 3/4/5 类的原理小图具有动态电流亮点、场轴/转子标记及支路动画。
- 四组并排双三维对比，每组六幕：结构、电流、磁场、转子、负载、能量链。
- 科学仪器主题的入场环形动画；遵循减少动态效果偏好。
- `src/director.js` 管理自动导演、字幕与双模型对比。

## Git 与发布

PR 合并到组织仓库 main（或在明确授权下推送 main）后，`.github/workflows/pages.yml` 自动重新生成离线页、校验物理关系并发布 GitHub Pages。
发布地址：`https://czl-homelab.github.io/Visualization-of-Science-and-Engineering/motor-lab/`。
构建：`python build.py`；检查：`node tests/check-model.cjs`。
所有运行依赖仍内嵌在 index.html 中，三维模型与课程可离线使用。

---

# 电机原理 3D 实验室 · 离线版 v3.0

直接双击 `index.html`，用支持 WebGL 的 Chrome、Edge、Firefox 或 Safari 打开。
网页内嵌三维引擎、程序模型、样式与全部课程；不需要服务器、账号、npm 或联网。
原厂资料链接需要网络。可选语音使用浏览器/操作系统的中文语音，是否离线取决于安装的语音包。

## 从哪里开始

1. 选择一种电机，右侧从第 1 步开始。
2. 点“自动讲解”：自动切换八个步骤，同时调整模型、分解距离、视角与重点部件。每步至少 18 秒；开启语音后等待本步朗读完成。
3. 随时点击步骤编号、上一步/下一步，或“暂停讲解”自行阅读。
4. 点击三维零件或下方零件索引，阅读其作用；“单独查看”放大研究该部件。
5. 使用整体、剖面、爆炸分解、透视内部四种模式。用拆解距离滑块连续拆开或装回。
6. 暂停动画后点“步进 60°”，同时看电流状态、磁场矢量、同步原理简图与波形。
7. 走完八步，做页面底部的理解检验题，再与另一类电机对照。

## 这次的三维升级

- 真正的 WebGL 三维网格、金属/铜线材质、环境反射、灯光和景深关系；模型由代码生成。
- 散热筋、端盖加强筋、紧固螺钉、叠片、齿、铜线匝、绝缘骨架、轴与键槽。
- 轴承的内外圈、保持架和滚珠；爆炸分解中可单独观察。
- 永磁转子的弧形 N/S 磁体、磁轴标记。
- 鼠笼的 24 根斜导条与两端闭合短路环；铁芯可分层移开。
- 有刷结构的固定碳刷、刷架、弹簧及随轴转动的两片绝缘换向器。
- 电容运转结构的主副绕组和电容，罩极结构的突出磁极与闭合铜环。
- 动态相电流亮点、三相合成矢量、转子磁轴、载流导体受力方向、局部磁通强弱示意。
- 适配画面、四个相机视角、放大实验台、拖动/键盘旋转、滚轮/双指缩放。

## 六类课程，每类八步

| 电机 | 重点 |
| --- | --- |
| BLDC 六步换相 | 定子线圈、永磁转子、六开关桥、两相导通一相悬空、逐拍换相 |
| 有刷直流 | 永磁定子、旋转电枢、固定碳刷、分段换向器、中性面反接 |
| 正弦驱动 PMSM | 三相正弦电流、分量相加、旋转场、同速与固定磁轴夹角 |
| 三相鼠笼异步 | 斜导条、短路环、闭合回路、感应电流、持续转差 |
| 单相电容运转 | 主副绕组空间错开、电容支路时间错相、椭圆磁场、鼠笼感应 |
| 罩极 | 主绕组、部分极靴上的短路铜环、局部磁通滞后和启动方向 |

原有的原理文章、分类对照、效率损耗账本、风机相似定律、常见误区和资料链接继续保留。

## 操作说明

- 拖动或方向键：改变相机；滚轮或双指：缩放；“适配画面”：把当前可见部件放进画面。
- “单独查看”：只显示选中零件；再次点击返回。“显示全部”取消选中。
- “放大实验台”：放大工作区；再次点击或 Escape 返回。
- 空格：暂停/继续电机动画（表单、按钮等具有焦点时保留原生按键行为）。
- “自动讲解”和电机“运行/暂停”是两个控制：暂停讲解保留当前运动；点击运行/暂停或步进会结束自动翻页。
- 切换步骤会恢复该步骤的默认展示状态；切换电机从第 1 步开始。
- 语音默认关闭。没有中文语音包时显示文字提示并继续文字课程。

## 主题与项目导航

- 右上角按钮在深色与浅色之间切换；首次访问跟随系统 `prefers-color-scheme`，选择会写入 `localStorage` 的共享键 `czl-lab-theme`，并同步 `meta[name="theme-color"]`。两套主题都内联在 `index.html` 中，离线可用，不请求远程字体或样式。
- 顶栏左侧的 `Lab Projects` 返回项目目录；页脚前的“换一个实验室”目录列出全部实验室、标记当前页，并提供返回目录的链接；滚动后右下角有“↑ 顶部”。链接使用相对路径，Pages 子路径与 `_site` 的本地 `file://` 预览可解析；把单个文件复制到别处时，目录链接需要保持同样的站点结构。
- 主题切换会通知三维引擎调整网格与坐标轴透明度；浅色为暖纸色舞台，深色维持石墨舞台。两种主题下都应检查标签、网格、焦点环与窄屏布局。

## 教学边界

- 这是精细的原理模型，仍不是制造 CAD、有限元计算或拆装维修规程。
- 统一两极、内转子示意，气隙、绕组匝数及尺寸做过简化。
- 笼架与铁芯分离、外壳沿轴展开等为教学分层；真实压铸鼠笼不可直接从铁芯抽出。
- 动画大幅慢放，与显示 rpm 不按真实时间同步。标记、流动亮点、箭头表示方向和关系，不是电子漂移速度或实测场强。
- 除预设拆解运动外，只展示简化稳态，未计算启动惯量、堵转、饱和、失步、PWM 细节或电流闭环。
- BLDC 使用平滑跟随模型；PMSM 使用简化磁轴夹角，不代替 FOC/dq 模型。
- 感应机转差随负载线性变化，用于解释趋势，不是真实转矩曲线。
- 单相电容示意相位差 70°、幅值比 0.8；真实值取决于电容、绕组和工况。
- 罩极使用两个局部磁通分量展示时序，不画成理想圆形三相磁场。
- 有刷模型为单线圈、两片换向器；未模拟中性面电流暂态和转矩死点启动。
- 轴承滚珠用于展示结构，不求解滚珠自转/公转接触运动学。
- 驱动板位置是功能示意，实际电机常使用外置驱动器。
- 损耗账本是假设效率下的算术分配，不预测温升或真实电机效率。

## 文件与维护

- `index.html`：最终单文件离线网页，可单独复制或在网页内下载。
- `src/page.html`、`src/lab.css`：页面与样式。
- `src/core.js`：原有课程、工作点、波形和损耗计算。
- `src/courses.js`：48 个步骤、部件说明与六道检验题。
- `src/engine.js`：三维几何、材质、标注、视角与动画。
- `src/app.js`：交互、分步讲解、可选语音、同步电路简图。
- `vendor/three.min.js`：固定版本 Three.js 0.160.1；MIT 许可见 `vendor/THREE-LICENSE.txt`。使用 UMD 构建以保持 file:// 单文件运行，不依赖 CDN。
- `build.py`：用 Python 标准库重新生成 `index.html`；修改源码后运行 `python build.py`。
- `tests/check-model.cjs`：独立校验三相磁场、六步矢量、转差、换向转矩符号、磁极几何及离线封装；运行 `node tests/check-model.cjs`。
- `work/index-v2-original.html` 与 `work/README-v2-original.md`：修改前备份。

## 原理参考

- Microchip：Six-Step Commutation of Three-Phase BLDC Motor
  https://onlinedocs.microchip.com/oxy/GUID-04B5982F-17EC-4A6E-B7FE-72DF0A5463B9-en-US-3/GUID-A1DD3CA4-D59F-45CF-AA9F-EBBCB9EF37BA.html
- Oriental Motor：Structure and Operating Principle of Induction Motors
  https://www.orientalmotor.com.sg/sg/tech/reference/ac-motor01
- Nidec：Capacitor-run motor, Capacitor-start motor
  https://www.nidec.com/en/technology/motor/glossary/item/capacitor-run_motor/
- Nidec：Rotating Speed of DC Motor and Counter-electromotive Force
  https://www.nidec.com/en/products/small-precision-motors/contents/technology/motor/basic/00013/

2026-10-29

## English — Motor Lab v3.1

Canonical repository: [CZL-Homelab/Visualization-of-Science-and-Engineering](https://github.com/CZL-Homelab/Visualization-of-Science-and-Engineering). [Open Motor Lab](https://czl-homelab.github.io/Visualization-of-Science-and-Engineering/motor-lab/) or return to the [project directory](https://czl-homelab.github.io/Visualization-of-Science-and-Engineering/). Source is under Projects/motor-lab; the maintainer's F-drive path is an example, not a required location. Read the root contribution guide and local AGENTS.md.

### Run and explore

Open index.html in a modern WebGL-capable browser, or run python -m http.server 8766 --bind 127.0.0.1 in this directory. All model code, styles and the shared SVG identity are embedded; no account, server, npm installation or network is needed for the demonstration itself. External reference links require a connection. Optional speech depends on browser/OS Chinese voice availability and may require networking.

Each of the six motors starts with a running showcase, then automatically enters an eight-scene tour after 12 seconds and proceeds to other motors. Tours coordinate motion, decomposition, camera, emphasis and in-scene captions. Choose any scene, pause, or restart from the beginning. Speech is off by default. Reduced-motion preferences suppress automatic movement.

Click a model part or its index to read its role; isolate it for closer inspection. Use assembly, cutaway, exploded and X-ray modes or the explosion slider. Drag or use arrow keys to rotate the camera; scroll/pinch to zoom. Fit view restores framing. Expand the lab and press Escape to exit. Space toggles motor motion unless a form/control has focus. Pause before stepping 60 electrical degrees to compare currents, field direction, diagrams and waveforms. Pausing the tour preserves current motor motion; motor pause/step ends automatic scene advancement. Changing scenes restores that scene's defaults.

### Content and identity

The models include ribs, covers, bolts, laminations, teeth, copper turns, insulation, bearings, shaft/keyway, permanent magnets, a 24-bar cage with shorting rings, brush holders/springs and a split commutator, capacitor branches and closed shading rings. Materials, lighting and reflections improve spatial readability. Phase particles, field vectors and force directions remain explanatory markers.

BLDC covers six-step commutation, two conducting phases and one floating phase. Brushed DC covers stationary magnets/brushes, a rotating armature/commutator and current reversal. PMSM covers smooth three-phase fields, synchronous speed and magnetic-axis angle; stable phase colors darken/lighten with absolute current. Three-phase induction covers cage closure, induced current and slip. Capacitor-run motors cover spatially separated windings, phase-shifted currents and elliptical fields. Shaded-pole motors cover local flux lag in the shaded region.

Four comparison pairs provide six scenes each: BLDC/PMSM, synchronous/induction, capacitor-run/shaded-pole, and brushed/brushless. They compare structure, current paths, fields, rotors, load and energy chains. The phase-diagram brightness is not instantaneous PWM gating. Original articles, taxonomy, energy-loss arithmetic, fan similarity laws, FAQs, quizzes and manufacturer references remain available.

### Theme and lab navigation

The header button switches between dark and light. First visit follows `prefers-color-scheme`; an explicit choice is stored under the shared `czl-lab-theme` key and mirrored to `meta[name="theme-color"]`. Both palettes are inlined in index.html, so the file stays offline and requests no remote fonts or styles.

`Lab Projects` at the top-left returns to the catalog. The "Lab projects" directory above the footer lists every lab, marks the current page and links back to the catalog. Both labs show a floating “top” button after 600px of scrolling, hidden when the page is short. Relative paths keep Pages subpaths and local file:// previews working. The theme switch also updates grid and axis opacity in the 3D engine; light mode uses a warm paper stage, dark mode keeps graphite. Check labels, grids, focus rings and narrow layouts in both themes.

### Model boundaries

These are educational procedural geometries, not manufacturing CAD, finite-element results or repair instructions. Dimensions, gaps and turns are simplified around a two-pole internal-rotor arrangement. Exploding an embedded cage out of its core is an explanatory separation, not a real disassembly operation. Animation is heavily slowed relative to indicated rpm; particles are not electron drift speeds and brightness is not measured field strength.

Motion uses simplified steady-state operating points rather than startup inertia, stall, saturation, loss of synchronism, PWM transients or current loops. BLDC follows a prescribed smooth response; PMSM uses a simplified magnetic-axis angle rather than a full FOC/dq solution. Induction slip varies linearly with load for teaching. Capacitor-run examples assume 70-degree phase separation and amplitude ratio 0.8; actual values depend on the design and operating point. Shaded-pole fields show local timing rather than an ideal circular three-phase field. The single-coil/two-segment brushed model does not solve neutral-plane transients or dead-point starting. Bearing balls illustrate structure, not contact kinematics. Drive-board placement is illustrative. The efficiency ledger uses assumed arithmetic allocations and predicts neither measured efficiency nor temperature. Fan blades do not automatically apply an aerodynamic load curve.

### Maintain and publish

Edit src/ and run python build.py. Run node tests/check-model.cjs and the syntax commands in AGENTS.md; commit the generated index.html. No npm installation is needed. core.js handles the inherited lessons and operating points; courses.js contains scene content; engine.js builds the models; app.js controls interaction and diagrams; director.js directs tours and comparisons. Shared identity is embedded from ../../assets/icon.svg. vendor/three.min.js is Three.js 0.160.1 under the preserved MIT license. Historical v2 files under work/ are backups.

Merging to the organization repository's main triggers Pages validation and publishing. Source, build and route guidance is in the root README. Manufacturer references above include Microchip BLDC commutation, Oriental Motor induction/PSC structure, and Nidec capacitor-run and DC back-EMF explanations. Their links are shared by both language versions.
