# Desalination Lab · 海水淡化原理实验室

一个可离线运行的海水淡化教学实验台：从含盐阶梯与渗透压出发，逐层拆到反渗透单段质量守恒、多级闪蒸、膜污染、能耗口径与整厂浓盐水平衡。7 个模块、25 幕自动讲解，全部资源内嵌在单个 `index.html` 里，断网、直接双击也能运行。

中文为主，英文技术术语以小号标签出现。所有数值要么来自带核对日期的公开资料，要么明确标注为教学模型。

## 运行与构建

需要 Git、Python 3.9+ 与 Node.js 22 LTS；无 npm 依赖、无 Python 第三方包。

```sh
cd Projects/desalination-lab
python3 build.py                 # 生成单文件 index.html
for f in src/*.js src/modules/*.js; do node --check "$f"; done
node tests/check-physics.cjs     # 物理不变量
node tests/check-build.cjs       # 离线封装与锚点
node tests/check-scenes.cjs      # 讲解 → 控件 → 3D 状态联动
python -m http.server 8766 --bind 127.0.0.1   # 在此项目目录运行时，预览 http://127.0.0.1:8766/
```

`src/` 是源码真身；`index.html` 是生成物，随源码一起提交。维护规则见 [AGENTS.md](AGENTS.md)，当前 PR 与发布状态见 [交接记录](../../docs/HANDOFF.md)。

## 模块一览

| 模块 | 内容 |
| --- | --- |
| A 水与盐 | 地球水分布、TDS/电导率/密度、饮用水口径 |
| B 渗透与渗透压 | 半透膜装置、van 't Hoff、273 米水柱、方向翻转 |
| C 反渗透 RO | 压力-通量-盐平衡-能耗联动，单段质量守恒 |
| D 蒸馏法 | MSF 闪蒸瀑布、GEA、顶卤温度边界、口径提醒 |
| E 膜与污染 | TFC 剖面、截留率、通量衰减曲线、结垢阈值 |
| F 能耗与成本 | 理论最小分离功、SWRO/MED/MSF/太阳能蒸馏对比 |
| G 整厂流程 | 取水→预处理→RO→再矿化→管网 + 浓盐水扩散器 |

## 模型边界（重要）

- 渗透压按 NaCl 等效稀溶液（有效系数 1.8）估算；真实海水在 ±10% 内一致，高浓盐水只是量级参考。
- RO 是单级单段教学模型：无多段级联、无局部浓差极化计算、无粘度修正；GEA 是单调教学相关性。
- 能耗与成本为文献区间（GED 口径），用于量级对比；决策必须回原始资料。
- 程序动画不是工程仿真。理论最小分离功展示为“锚定文献值的教学近似”（1.06 kWh/m³ @ 50% 回收率）。
- 浓盐水排放只做质量守恒教学；环评、混合区与取水生物影响不在模型内。

## 数据口径与来源

口径页核对日期 2026-11-10，来源包括 USGS Water Science School、WHO TDS 背景文件、EPA 二类饮用水标准、IDA、UF/IFAS SS746，以及给出 SWRO 最小分离功 ≈1.06–1.07 kWh/m³ 的公开论文全文链接。引用页面数字时请同时注明核对日期。

## 主题与导航

遵循仓库全站约定：`czl-lab-theme`、首次绘制前 `data-theme`、可读主题按钮与 `aria-pressed`、顶栏 `Lab Projects` 返回入口、页脚前实验室目录（四个实验室、标记当前页）。深浅色与 390px 窄屏均已检查。

## English

Desalination Lab is a single-file, fully offline teaching bench for seawater desalination: seven modules covering the salinity ladder, osmotic pressure, a parameter-driven single-pass RO stage (mass balance and energy in sync), MSF flash cascades, membrane fouling, energy-accounting comparisons and a whole-plant balance with remineralisation and brine disposal. All physics math lives in `src/core.js` and is pinned by 23 invariant tests; literature values carry a verification date and source links. Animations are teaching models, not engineering simulations.

Read [AGENTS.md](AGENTS.md) and the [current handoff](../../docs/HANDOFF.md) before maintenance. Build and verify: `python3 build.py`, `node --check` on all sources, `node tests/check-physics.cjs`, `node tests/check-scenes.cjs`, `node tests/check-build.cjs`. Commit the generated `index.html` with source changes.

## 3D 交互 / 3D controls

B/C/G 默认进入 3D，保留 2D 剖面切换。拖动或用方向键旋转，滚轮、加减键或按钮缩放；可暂停流动、复位镜头，RO 支持外壳/剖切切换。减少动态效果偏好默认暂停流动；模型参数和读数仍可操作。切换模块时释放 GPU 几何、材质与纹理；WebGL 不可用时可切回 2D。

卷式 RO 以卷绕膜片、进水流道和中心集水管表示，不采用螺旋管替代膜。结构参考 [DuPont FilmTec 技术手册 §1.7](https://www.dupont.com/content/dam/water/amer/us/en/water/public/documents/en/RO-NF-FilmTec-Manual-45-D01504-en.pdf)（核对 2026-11-13）；层间距、水路和设备尺寸有意放大。压力作用在盐水侧，滑块米数是等效淡水柱压头；未模拟真实自由液面演化。整厂粒子沿管线流动，浓盐水支线独立接至扩散器；不计算排海羽流或环评结果。

B/C/G open in 3D with a 2D alternative. Drag or use arrow keys to orbit, scroll or use +/- to zoom, pause flow, reset the camera, and toggle the RO shell/cutaway. Reduced motion starts paused; state changes still update the model. GPU resources are released when switching modules. A WebGL fallback retains access to 2D views.

The RO geometry uses wound membrane sheets and a separate collection tube, informed by the DuPont manual linked above (checked 2026-11-13). Spacing, paths and equipment are exaggerated teaching illustrations. Pressure acts on the saline side; metres denote an equivalent freshwater pressure head, not simulated liquid-level evolution. Plant particles follow connected pipes to a separate brine diffuser; no plume or environmental impact is calculated. Run `node tests/check-scenes.cjs` to verify lesson patches drive the live 3D state.

## 入场与主题特性 / Entrance and theme features

进入本 Lab 时显示简短的膜分离入场动效，约 1.6 秒自动结束。可立即跳过，顶栏可回放；鼠标/键盘操作或页面隐藏会清理入场，锚点链接直接进入目标内容。系统“减少动态效果”会跳过入场并禁用回放。共享 Logo、主题及动效在构建时内嵌，保持离线使用；下载后重开不重复生成按钮。

默认跟随系统浅色/暗黑偏好，手动选择记入 `czl-lab-theme`；没有手动覆盖时跟随系统实时变化。同源页面同步主题，页脚“主题：跟随系统”恢复自动模式。不是按本地时钟强制切换。公共维护约定见 [根 AGENTS](../../AGENTS.md)，实现入口见 [资源说明](../../assets/README.md)。

The short membrane separation entrance ends automatically in about 1.6 seconds. Skip immediately or replay from the header; pointer/keyboard interaction or hiding the page clears it, and deep links open directly. Reduced motion bypasses the entrance and disables replay. Logo/theme/entrance assets are embedded offline at build time; reopening a downloaded snapshot does not duplicate controls.

Theme follows the system's light/dark setting until a manual choice is saved under czl-lab-theme. Unoverridden pages follow live system changes, same-origin pages synchronize, and the footer system-theme button restores automatic mode. There is no forced day/night clock rule. See root AGENTS and asset guidance linked above for shared maintenance.
