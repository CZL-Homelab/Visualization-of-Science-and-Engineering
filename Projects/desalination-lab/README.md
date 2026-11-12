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
python -m http.server 8766 --bind 127.0.0.1   # 预览 http://127.0.0.1:8766/desalination-lab/
```

`src/` 是源码真身；`index.html` 是生成物，随源码一起提交。

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

遵循仓库全站约定：`czl-lab-theme`、首次绘制前 `data-theme`、可读主题按钮与 `aria-pressed`、顶栏 `Lab Projects` 返回入口、页脚前实验室目录（三个实验室、标记当前页）。深浅色与 390px 窄屏均已检查。

## English

Desalination Lab is a single-file, fully offline teaching bench for seawater desalination: seven modules covering the salinity ladder, osmotic pressure, a parameter-driven single-pass RO stage (mass balance and energy in sync), MSF flash cascades, membrane fouling, energy-accounting comparisons and a whole-plant balance with remineralisation and brine disposal. All physics math lives in `src/core.js` and is pinned by 21 invariant tests; literature values carry a verification date and source links. Animations are teaching models, not engineering simulations.

Build and verify: `python3 build.py`, `node --check` on all sources, `node tests/check-physics.cjs`, `node tests/check-build.cjs`. Commit the generated `index.html` with source changes.
