# Distillation Lab · 精馏原理实验室

**用可调参数的相图、动画塔板与对照实验，理解各种精馏为什么这样设计。**

*单文件离线 · 零运行时依赖 · MIT 许可*

Distillation Lab 是 [科学与工程可视化](https://czl-homelab.github.io/Visualization-of-Science-and-Engineering/) 中的化工分离教学项目。它从两种液体的蒸气压出发，依次拆开闪蒸、简单蒸馏、连续精馏与间歇精馏，再走到共沸、变压、萃取、减压、水蒸气蒸馏和原油常压塔。每个模块都要求你亲手改参数，看相图、塔板组成、级数和能耗如何一起变化。

> 所有数字由页面内的教学模型现算：Antoine 方程 + Raoult / NRTL / van Laar 活度系数 + 恒摩尔流。乙醇–水相平衡、乙二醇萃取与一座苯–甲苯基准塔已与 Aspen Plus V15 严格计算逐项对照（见“Aspen Plus V15 对照”）。它们用于理解机理，不可直接用于塔设计、安全泄放或操作决策。

---

## 快速开始

无需 npm、无需后端、无需联网。仓库根目录执行：

```sh
cd Projects/distillation-lab
python3 build.py                  # 生成单文件离线网页 index.html
node tests/check-thermo.cjs       # 37 条热力学、塔计算与 Aspen 对照不变量
node tests/check-build.cjs        # 离线封装、主题与导航约定、10 个模块、Aspen 数据
python3 -m http.server 8766 --bind 127.0.0.1   # 或直接双击 index.html
```

`index.html` 是完整交付物，可单独复制到任何机器离线打开。`src/` 才是需要修改的源码；不要只编辑生成页。

**浏览器要求：** 近两年的 Chrome、Edge、Firefox 或 Safari（Canvas 2D、SVG、`ResizeObserver`、CSS 自定义属性）。语音讲解使用浏览器 `speechSynthesis`，默认关闭。

---

## 十个模块

| 模块 | 你会亲手做什么 | 核心概念 |
| --- | --- | --- |
| **A 气液平衡** | 切换体系、改总压与液相组成；在蒸气压曲线、T–x–y、x–y 图上看同一个平衡点 | Antoine、Raoult、泡点/露点、α、正/负偏差、恒沸 |
| **B 闪蒸与简单蒸馏** | 调汽化分率，对比分离罐与圆底烧瓶两套装置 | 单级平衡、杠杆规则、Rayleigh 方程、单级的纯度上限 |
| **C 连续精馏：McCabe–Thiele** | 调 xF、q、xD、xW、R/Rmin 与进料位置；悬停动画塔板，右侧台阶同步高亮 | 操作线、q 线、理论级、Rmin 夹紧、全回流 Nmin、最优进料 |
| **D 回流比、能耗与简捷法** | 拖动 R/Rmin，看级数曲线与成本 U 形曲线；改能源价格与设备费权重 | Fenske、Underwood、Gilliland（Eduljee）、再沸器负荷、最优回流比 |
| **E 间歇精馏** | 简单蒸馏 / 恒回流 / 恒馏出组成三种操作；拖动批次进程或“运行批次” | 釜液变贫、R(t)、批次时间、主馏分与过渡馏分 |
| **F 共沸、变压与萃取精馏** | 尝试越过恒沸点；调两塔压力；调乙二醇分率；看非均相共沸流程 | 最低/最高恒沸物、恒沸点随压力移动（对照 Aspen）、循环量、三元 NRTL 下的溶剂效应、分层器 |
| **G 减压与水蒸气蒸馏** | 拖低总压；切换水蒸气蒸馏；自定义高沸物的 Tb 与 M | 沸点–压力关系、不互溶液体共沸腾、蒸汽耗量 |
| **H 塔板、填料与效率** | 拖动气、液负荷看筛板/浮阀/填料工况；调 Murphree 效率与 HETP | 漏液、雾沫夹带、液泛、操作弹性、伪平衡线、塔高 |
| **I 原油常压蒸馏** | 切换轻/中/重质原油，拖动 5 个切割点与分馏精度 | TBP 曲线、侧线抽出与汽提、收率、产品重叠、渣油去减压塔 |
| **J 同步对比实验室** | 9 组并排实验：回流、进料热状态、α、进料位置、板效率、恒沸体系、闪蒸 vs 简单蒸馏、常压 vs 减压、简化模型 vs Aspen 严格模拟 | 同一起点只改一个变量；最后一组看恒摩尔流模型差在哪里 |

每个模块有 6–9 幕自动讲解、可暂停/上一幕/下一幕/重播、中文旁白（可选）和 3–4 道理解检验题。**任何手动操作都会立即接管并暂停自动讲解**。

---

## 操作方式

- **自动讲解**：底部 ▶ 播放；`空格` 暂停/继续；← → 切换幕；↺ 重播当前模块。
- **手动实验**：右侧滑块旁的数字框可输入精确值；每个模块底部有“恢复默认”。
- **联动**：模块 C 与首屏中，悬停塔板会高亮 McCabe–Thiele 图上的同一级，反之亦然。
- **深浅色**：右上角切换；未手动选择时跟随系统并实时响应，手动选择写入共享键 `czl-lab-theme`，页脚“主题：跟随系统”可恢复自动。主题与入场动效由仓库公共的 `assets/theme.js`、`assets/entry.js` 在构建时内嵌（入场约 1.6 秒，可跳过、可在顶栏回放，减少动态效果时不播放）。
- **自定义平衡数据**：页面下方可粘贴或选择 CSV（两列 x, y），载入后模块 A 与 C 多出“导入数据”体系。数据只在当前浏览器中使用，不上传。
- **离线保存**：右上角“离线网页”下载当前页面的单文件副本。

移动端（390×844）为单列布局：图表、讲解与参数面板依次排列。

## 项目导航

- 顶栏左侧 `Lab Projects` 返回组织站点项目目录；页脚前的“换一个实验室”目录列出全部实验室并标记当前页。
- 链接使用相对路径（`../<slug>/index.html`、`./index.html`、`../index.html`），Pages 子路径与 `_site` 本地预览都能解析。`tests/check-build.cjs` 按 `site/projects.json` 核对目录覆盖全部已登记实验室。
- 新增实验室时，需同时更新本页目录、其他实验室页内的目录与 `site/projects.json`。

---

## 数据与模型

### 纯组分

`src/thermo.js` 中的 Antoine 常数（log₁₀p/mmHg = A − B/(C + T/°C)）为常用手册数值，覆盖苯、甲苯、正己烷、正庚烷、乙醇、水、丙酮、氯仿，乙二醇由 NIST 的 bar/K 常数（4.97012, 1914.951, −84.996）换算；水与乙醇有两个温区，重叠区内对 log p 线性过渡以避免跳变。常数已与 [NIST Chemistry WebBook](https://webbook.nist.gov/chemistry/) 的 bar/K 拟合交叉核对（适用温区内压力偏差 ≤ 1.6 %），模型常压沸点与文献值相差 ≤ 0.3 °C。页面“物性与模型”一节列出全部常数与对比。

### 二元体系

| 体系 | 模型 | 说明 |
| --- | --- | --- |
| 苯–甲苯、正己烷–正庚烷 | Raoult（理想溶液） | α 约 2.3–2.6 / 无恒沸 |
| 乙醇–水 | NRTL，τᵢⱼ = aᵢⱼ + bᵢⱼ/T（T/K），Gᵢⱼ = exp(−cᵢⱼτᵢⱼ) | Aspen Plus V15 APV150 VLE-IG 参数；模型恒沸点 1 atm 下 x = 0.897、78.16 °C（文献 0.894、78.15 °C） |
| 丙酮–氯仿 | van Laar，A₁₂ = −0.8444，A₂₁ = −0.5868 | 由 1 atm 最高恒沸点 x = 0.34、64.5 °C 反算 |
| 恒定 α | y = αx/(1 + (α − 1)x) | 理想化，只有 x–y 关系 |
| 乙醇–水–乙二醇（模块 F） | 三元 NRTL | 三对二元参数均取自 Aspen APV150（乙醇–乙二醇 cᵢⱼ = 0.47） |

丙酮–氯仿的 van Laar 参数视为与温度无关，改变压力后的恒沸组成只示意方向。乙醇–水的 NRTL 参数随温度变化，恒沸点随压力的移动与 Aspen 一致（见下表）；文献中乙醇–水恒沸点在约 9 kPa 以下消失，模型在 20 kPa 以下不能保证这一点。

### Aspen Plus V15 对照

项目维护者用 Aspen Plus V15（中文界面，物性方法 NRTL，APV150 数据库）导出了三组数据，原样收录在 `src/aspen.js`，页面“物性与模型”一节与模块 A、F、J 直接调用：

1. **NRTL-1 二元参数**：水、乙醇、乙二醇、苯、甲苯两两之间共 10 组（含水–苯 LLE 参数）。本页实际使用乙醇–水、水–乙二醇、乙醇–乙二醇三组，测试锁定 `thermo.js` 中的数值与 Aspen 原表逐位一致。
2. **乙醇–水 T–x–y**：20、101.325、500、1000 kPa 各 41 点，含 γ。模块 A 把它们画成白色圆点。
3. **RadFrac 基准塔**：苯–甲苯，16 级（含冷凝器与再沸器），第 8 级进料，F = 100 kmol/h、z = 0.45、饱和液体，R = 1.9，D/F = 0.45，101.325 kPa，IDEAL 物性方法；逐级温度、液相组成与气液流量。模块 J 的“简化模型 vs Aspen 严格模拟”用本页的恒摩尔流逐级计算（操作型：给定级数与进料级求产品组成）与之对照。

| 对照项 | 结果 |
| --- | --- |
| NRTL 活度系数 | 164 个点全部与 Aspen 的 γ 相对误差 < 10⁻⁵（T 取 K） |
| 乙醇–水泡点 / 气相组成 | 20–1000 kPa 全部点 \|ΔT\| ≤ 0.21 °C、\|Δy\| ≤ 0.0024（差异来自 Antoine 与 Aspen 蒸气压关联式） |
| 恒沸组成 | 20 / 101.3 / 500 / 1000 kPa：Aspen 0.935 / 0.896 / 0.847 / 0.819（相邻点插值），模型 0.929 / 0.897 / 0.854 / 0.826，偏差 < 0.008 |
| 萃取精馏 | 液相乙二醇 ≥ 约 3 mol% 时溶剂无基 x′–y′ 曲线不再穿过对角线；50 mol% 时最小 α ≈ 3.04，气相乙二醇 ≤ 2.8 % |
| RadFrac 基准塔 | 塔顶 xD：模型 0.969 / Aspen 0.965；塔底 xW：0.025 / 0.028；逐级组成偏差 ≤ 0.025，温度 ≤ 0.6 °C。Aspen 中精馏段液相流量约 80–85 kmol/h、再沸器上升蒸汽 123.5 kmol/h，而恒摩尔流假设分别为 85.5 与 130.5——这正是简化模型的误差来源 |

页面数据表里的每一项都在浏览器中由收录的原始数据现算，`tests/check-thermo.cjs` 用同样的容差锁定。

### 计算方法

- **活度系数**：NRTL 按 Aspen 约定 τᵢⱼ = aᵢⱼ + bᵢⱼ/T + eᵢⱼ ln T（本页用到的参数 e = 0），αᵢⱼ = cᵢⱼ；泡点在温度二分中每步重算 γ。三元泡点 Σxᵢγᵢpᵢ* = P 同样二分求解。
- **McCabe–Thiele**：恒摩尔流、全凝器、部分再沸器计为一级；最优进料级为台阶跨越操作线交点的那一级；Murphree 气相效率通过伪平衡线实现。
- **最小回流比**：精馏段操作线绕 (xD, xD) 旋转，取 q 线夹紧与切点夹紧中的较大者；恒定 α 时与 Underwood 结果一致（测试锁定 Rmin = 1.10）。
- **简捷法**：Fenske、二元 Underwood、Gilliland 关联（Eduljee 1975 拟合）。
- **闪蒸**：按汽化分率求解杠杆规则；**简单蒸馏**：Rayleigh 方程 RK2 积分。
- **间歇精馏**：忽略持液的准稳态模型，dW/W = dxW/(xD − xW)，dt = (R + 1)dD/V。
- **水蒸气蒸馏**：不互溶液体 p*水 + p*有机 = P；自定义高沸物用 Clausius–Clapeyron + Trouton 规则（ΔS ≈ 88 J/(mol·K)）估算。模型给出甲苯–水 84.4 °C、80.4 wt%（文献约 84.1 °C、80.4 wt%）。
- **能耗与成本**：再沸器负荷 ≈ V′·λ（平均汽化潜热）；成本曲线只是示意函数（塔体 ∝ N·√V，换热器 ∝ V^0.65，能耗 ∝ V）。
- **原油**：三条合成 TBP 曲线；收率 = 切割点之间的体积 %；产品重叠用逻辑函数示意。
- **操作型计算（rateColumn）**：给定理论级数、进料级、R 与 D/F，二分塔顶组成直到逐级计算落到物料衡算给出的塔底组成；用于与 RadFrac 对照。

### 方法参考

McCabe & Thiele (1925)；Fenske (1932)；Underwood (1948)；Gilliland (1940) 与 Eduljee (1975)；Rayleigh (1902)；Renon & Prausnitz (1968, NRTL)。教材层面的推导可参考 Seader, Henley & Roper《Separation Process Principles》与 McCabe, Smith & Harriott《Unit Operations of Chemical Engineering》。

---

## 简化假设与已知限制

1. 气相理想；液相 Raoult、NRTL（Aspen 参数）或温度无关 van Laar；不含液液分相计算（非均相共沸精馏只画流程）。
2. 萃取精馏用三元 NRTL 计算相平衡，但假定萃取段液相溶剂分数恒定，不做溶剂回收塔与能量衡算。
3. 恒摩尔流忽略焓差、热损失和持液；间歇模型忽略塔内持液与开车阶段。
4. 塔板操作区边界与“工况效率系数”为定性示意；真实值取决于开孔率、板间距、物性与负荷。
5. 原油 TBP 曲线为合成曲线，不对应任何具体原油或炼厂；塔温为典型范围。
6. 动画中的气泡与液滴只表达流向，不是水力学仿真。

---

## 技术架构

```text
distillation-lab/
  build.py              标准库构建：内联 CSS/JS 与站点图标，输出单文件 index.html
  index.html            生成的离线交付物（随源码提交）
  src/
    page.html           页面骨架与内容区
    lab.css             与 Stock Market Lab 一致的设计系统 + 相图/塔/示意图组件
    thermo.js           物性、相平衡（Raoult/NRTL/van Laar）、闪蒸、Rayleigh、McCabe–Thiele、操作型计算、FUG、间歇、水蒸气蒸馏、TBP（Node/浏览器双用）
    aspen.js            Aspen Plus V15 导出数据：NRTL 参数、乙醇–水 T–x–y、RadFrac 基准塔（Node/浏览器双用）
    ui.js               参数面板控件与格式化
    plots.js            SVG 图表：通用坐标系、McCabe–Thiele、T–x–y
    column.js           Canvas 动画精馏塔（连续/间歇）
    registry.js         模块注册、事件总线、体系选择
    modules/            A–J 十个教学模块，各含 scenes / quiz / mount
    app.js              导航、自动导演、主题、进度、自测、物性表、误区、导入
  tests/
    check-thermo.cjs    热力学与塔计算不变量，以及与 Aspen 数据的对照容差
    check-build.cjs     单文件离线封装、主题与导航约定、模块完整性
```

- 无框架、无打包器、无第三方运行时依赖；`build.py` 只做字符串内联与安全检查。
- 图表用 SVG（颜色写成 CSS 变量，切换主题无需重绘）；塔与塔板动画用 Canvas 2D，离开视口、页面隐藏或 `prefers-reduced-motion` 时停止。
- 每个模块通过 `DL.registerModule({...})` 注册，导演通过 `scenes[].patch` 驱动状态；所有公式只在 `thermo.js` 中实现。

## 构建、测试与发布

```sh
python3 build.py
for f in src/*.js src/modules/*.js; do node --check "$f"; done
node tests/check-thermo.cjs
node tests/check-build.cjs
git diff --check
```

CI 在 `.github/workflows/distillation-lab.yml` 中执行构建、语法、不变量与封装检查，并验证 `index.html` 已提交；Pages 工作流先构建本项目，再由 `scripts/build_site.py` 复制到 `_site/distillation-lab/`。目标地址：<https://czl-homelab.github.io/Visualization-of-Science-and-Engineering/distillation-lab/>（以实际部署为准）。目录条目：`site/projects.json`；预览图：`assets/distillation-preview.svg`。

---

## English

**Distillation Lab** is the chemical-engineering separation lab of the CZL-Homelab *Visualization of Science and Engineering* collection. It is a single offline HTML file with no runtime dependencies.

### Modules

A — vapour–liquid equilibrium (vapour pressure, T–x–y, x–y, relative volatility, azeotropes); B — flash vs simple (Rayleigh) distillation; C — continuous column with McCabe–Thiele and an animated column linked stage-by-stage; D — reflux, energy and the Fenske–Underwood–Gilliland shortcut with an illustrative cost optimum; E — batch distillation (simple, constant reflux, constant distillate composition); F — azeotropes and pressure-swing, extractive and heterogeneous azeotropic distillation; G — vacuum and steam distillation; H — tray/packing internals, operating window, Murphree efficiency and HETP; I — crude-oil atmospheric distillation, TBP curves and cut points; J — nine synchronized comparisons, the last one setting the simplified model against an Aspen RadFrac column. Each module has 6–9 guided scenes, optional speech and 3–4 check questions; any manual input takes over from the guided tour.

### Models and limits

Antoine constants (mmHg, °C) are common handbook values cross-checked against NIST WebBook fits (≤ 1.6 % in pressure; model normal boiling points within 0.3 °C of literature). Liquids follow Raoult's law, NRTL with Aspen Plus V15 APV150 parameters (ethanol–water and the ethanol–water–ethylene glycol extractive system), or temperature-independent van Laar parameters fitted to the 1 atm azeotrope (acetone–chloroform 0.34 / 64.5 °C). Column calculations assume constant molar overflow, a total condenser and a partial reboiler counted as one stage.

The project maintainer exported reference data from Aspen Plus V15 (NRTL, APV150), bundled in `src/aspen.js`: ten NRTL-1 binary parameter sets, ethanol–water T–x–y at 20, 101.325, 500 and 1000 kPa, and a 16-stage benzene–toluene RadFrac column. The lab reproduces Aspen's activity coefficients to < 1e-5, ethanol–water bubble points within 0.21 °C and azeotropes within 0.01 in x; the constant-molar-overflow rating calculation matches the RadFrac stage compositions within 0.025 and temperatures within 0.6 °C. The tray operating window, cost curve and crude TBP curves are illustrative. This is a teaching tool, not a design tool.

### Build and test

```sh
python3 build.py
node tests/check-thermo.cjs   # 37 thermodynamic, column and Aspen-comparison invariants
node tests/check-build.cjs    # offline packaging, shared theme/navigation, ten modules, Aspen data
```

Edit `src/`, rebuild, and commit the generated `index.html` together with the source. Theme and entrance come from the shared `assets/theme.js` and `assets/entry.js`, inlined by `scripts/shared_experience.py` (system default, remembered manual choice under `czl-lab-theme`, footer reset, skippable entrance). Navigation follows the repository conventions (`Lab Projects` back link, pre-footer directory covering every lab in `site/projects.json`). Check both themes and 390 px layouts before claiming a UI change works.
