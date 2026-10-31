# Stock Market Lab · 股票市场原理实验室

**用可操作的实验，理解股票市场为什么这样运转。**

*单文件离线 · 零运行时依赖 · MIT 许可*

Stock Market Lab 是 [科学与工程可视化](https://czl-homelab.github.io/Visualization-of-Science-and-Engineering/) 中的金融教学项目。它面向完全没有股票基础的学习者：从一根 K 线的四个价格开始，逐层拆到成交量与指标、订单簿撮合、A 股/美股制度、IPO 与再融资、估值、杠杆强平、ETF 与长期收益，最后用 10 组同步对比把容易混淆的概念并排放在一起。

它不是看盘软件，也不是“荐股”内容。每一页都要求你亲手改参数、看数字和图形如何一起变化，并明确标出哪些是**真实规则**、哪些是**教学模型**、哪些只是**模拟数据**。

> 所有行情、收益与公司数据均为模拟或固定随机种子生成；规则页记录核对日期，但规则会变化。本站不构成投资建议。

---

## 快速开始

无需 npm、无需后端、无需联网。仓库根目录执行：

```sh
# 1) 生成单文件离线网页
cd Projects/stock-market-lab
python3 build.py

# 2) 运行金融不变量与离线封装检查
node tests/check-finance.cjs
node tests/check-build.cjs

# 3) 本地预览（任选其一）
python3 -m http.server 8766 --bind 127.0.0.1
# 或直接双击/拖入浏览器打开 index.html
```

`index.html` 是完整交付物，可单独复制到任何机器离线打开。`src/` 才是需要修改的源码；不要只编辑生成页。

**浏览器要求：** 近两年的 Chrome、Edge、Firefox 或 Safari，支持 Canvas 2D、`ResizeObserver`、CSS 自定义属性。语音讲解使用浏览器 `speechSynthesis`，默认关闭。

---

## 十个模块

| 模块 | 你会亲手做什么 | 核心概念 |
| --- | --- | --- |
| **A 股票、公司与市场** | 调整股本、股价与持股比例；把一家公司“切”成股份；对比二级市场买卖与 IPO 缴款 | 股份、市值、股权稀释、一级/二级市场、指数与 ETF |
| **B K 线图** | 拖动开盘/最高/最低/收盘四个手柄；切换 A 股/美股配色与空心/实心；把 1 分钟数据聚合成日/周/月 K | 实体与影线、阳线≠当日涨跌、周期聚合、单根 K 线的信息损失 |
| **C 成交量与技术指标** | 调成交量、滑动 MA 窗口、改一个历史收盘价；切换 MA/VOL/RSI/MACD/KDJ/BOLL/WR/DMI/BIAS/OBV/CCI/ROC | 量价关系、均线滞后、超买超卖、指标失效 |
| **D 订单簿与撮合** | 提交限价/市价单；看订单排队、部分成交、扫盘滑点；比较买方压力/卖方压力/交易稀疏 | 价格优先、时间优先、买卖价差、流动性、交易成本 |
| **E A 股与美股** | 当日买入后尝试卖出；切换主板/创业板/科创板/北交所/新股；触发 LULD 与市场级熔断 | T+1 回转 vs T+1 交收、涨跌幅、最小交易单位、交易时段 |
| **F IPO 与资本运作** | 设定发行股数、发行价、利润与估值；拉动需求曲线；对比增发/配股/可转债/债务；回购/拆股/分红/换股并购 | 募资≠市值、摊薄、询价、资本结构 |
| **G 估值与基本面** | 调利润率、PE、PB、ROE、增长率与股本；看 EPS、市值、EV 如何变化 | PE/PB/ROE、市值 vs 企业价值、估值不是成交价 |
| **H 收益与杠杆** | 对比 1×/1.5×/2× 杠杆；调维持担保比例；跑缓慢下跌、跳空、连续跌停等场景 | 仓位、利息、维持担保比例、强平、路径依赖 |
| **I ETF 与长期投资** | 构造指数与 ETF；调相关性、费率、分红、定投与汇率；跑固定种子蒙特卡洛 | 分散、跟踪、费用拖累、总收益、复利 |
| **J 同步对比实验室** | 10 组并排实验：A 股/美股、日 K/周 K、红阳/绿阴、IPO/二级市场、高估/低估、满仓/满融、放量/缩量、分红/回购、拆股/增发、单股/ETF | 在相同初始条件下只改一个变量 |

每个模块都有约 6–10 幕自动讲解、可暂停/上一步/下一步/重播、中文旁白（可选）和 3–4 道理解检验题。**任何手动操作都会立即接管并暂停自动讲解**，不会在几秒后被覆盖。

---

## 操作方式

- **自动讲解**：底部 ▶ 播放；`空格` 暂停/继续；← → 切换幕；↺ 重播当前幕。
- **手动实验**：拖动右侧滑块、输入精确数值、点击市场/周期/指标切换。所有读数即时更新。
- **K 线图**：悬停查看 OHLC 与涨跌幅；拖动平移；滚轮缩放；双击复位；聚焦后可用方向键与 `+`/`-`。
- **恢复默认**：每个实验面板底部有“恢复默认”按钮；切换模块不会残留上一个模块的状态。
- **深浅色**：右上角切换；图表会随主题重绘。
- **导入数据**：页面下方“数据”区可粘贴或选择本地 CSV/JSON；导入后会标明来源、时间范围、时区、币种、复权与缺失情况。导入数据与模拟数据不会混在同一张图里。
- **离线保存**：右上角“离线网页”会下载当前页面的单文件副本。

移动端（390×844）为单列布局，图表与参数面板依次排列；触控可拖动/缩放 K 线。

---

## 数据与模型

### 默认数据

全部为**确定性模拟数据**：`src/datasets.js` 用 `mulberry32` 种子生成 OHLCV，包含持续上涨、持续下跌、高波动震荡、低波动横盘、跳空、放量、趋势反转与美股科技股等预设。相同种子在每次构建和每台机器上得到相同序列，测试可重复。

- 日 K 默认 150 根，跳过周末；分钟数据按 A 股交易时段（09:30–11:30、13:00–15:00）生成。
- 顶部指数条与首屏周 K 线是演示快照，不是实时行情。
- 所有图与卡片标注“模拟 / SIMULATED”。

### 导入真实历史数据（可选）

支持 CSV / JSON，字段别名包括 `date/datetime/time`、`open/o`、`high/h`、`low/l`、`close/c`、`volume/vol/v`，可选 `amount/code/market/adjusted`，也识别中文列名。解析器会：

- 校验 OHLC 约束（`Low ≤ min(O,C) ≤ max(O,C) ≤ High`）；
- 报告非法行、重复时间戳、价格跳变、缺失成交量；
- 标明来源文件、行数、时间范围、时区（本地）、币种/复权（数据未说明时明确写“未说明”）。

导入失败不会让页面崩溃，只会显示前几条错误。导入数据只在当前浏览器会话中使用，不上传。

### 计算引擎

`src/core.js` 是唯一的金融数学来源：OHLC 聚合、MA/EMA、RSI、MACD、KDJ、BOLL、WR、DMI、BIAS、OBV、CCI、ROC、涨跌幅/振幅/换手率、市值/EPS/PE/PB/ROE/股息率/EV、拆股/增发/分红/回购/换股并购、A 股/美股费用、杠杆与强平、CAGR/复利/实际收益、指数与 ETF NAV。`src/simulations.js` 负责订单簿撮合、IPO 需求、保证金路径与蒙特卡洛。模块只能调用这些函数，不重复实现公式。

`tests/check-finance.cjs` 用已知样本锁定这些公式（MA5=11.4、IPO 摊薄 16.67%、2× 杠杆下跌 40% 时权益亏 80%、维持担保比例 130% 等）。

---

## 金融规则与核对日期

**规则核对日期：2026-10-31。** 规则会变化；页面与 `src/market-rules.js` 都记录这个日期，发现过期时应更新常量、来源和测试。

### A 股

- **T+1 回转**：当日买入的股票下一交易日才能卖出。注意这不同于“交收”。
- **涨跌幅**：沪深主板 10%；创业板、科创板 20%；北交所 30%；风险警示股（ST/*ST）自 **2026-07-06** 起主板由 5% 调整为 10%，创业板/科创板 20%、北交所 30%。主板新股上市前 5 个交易日不设涨跌幅限制，第 6 日起按板块规则。
- **交易单位**：主板/创业板买入 100 股整数倍；科创板 200 股起、可按 1 股递增；卖出零股可一次性卖出。
- **费用示例**：佣金（示例 0.025%，最低 5 元，可改）、卖出印花税 0.05%、过户费 0.001%。券商实际费率与最低收费不同，页面允许修改。
- **交易时间**：09:15–09:25 开盘集合竞价，09:30–11:30、13:00–15:00 连续竞价（14:57 起收盘集合竞价）；盘后固定价格交易不在此模拟。

主要来源：[上海证券交易所](https://www.sse.com.cn/)、[深圳证券交易所](https://www.szse.cn/)、[北京证券交易所](https://www.bse.cn/)、[中国证监会](https://www.csrc.gov.cn/)。2026 年规则修订报道与文件：[上海证券报](https://www.cnstock.com/commonDetail/688560)、[证券时报](https://stcn.com/article/detail/3999724.html)、[上交所交易规则修订技术指南](https://www.sse.com.cn/services/tradingtech/development/c/10816505/files/8006a51174524e7cae832568b5e726a6.pdf)。

### 美股

- **T+1 交收**：自 **2024-05-28** 起，常规证券交易的交收周期为 T+1（[SEC 2024-62](https://www.sec.gov/newsroom/press-releases/2024-62)）。交收周期不等于“当日不能卖出”。
- **涨跌幅**：普通股票没有统一的每日 ±10% 限制；存在 LULD 价格带、个股停牌与市场级熔断。
- **LULD**：Tier 1 且股价 > $3 为 ±5%，$0.75–$3 为 ±10%；Tier 2 为 ±20%。触发后进入暂停/重新开盘流程。
- **市场级熔断**：标普 500 较前收跌 7%（L1）、13%（L2）、20%（L3）；L1/L2 在 15:25 前停 15 分钟，L3 当日停止交易。
- **保证金与日内交易**：Reg T 初始保证金 50%、维持 25%；PDT 账户门槛 $25,000（仅适用于典型日内交易账户，规则与券商有关）。
- **费用示例**：零佣金、卖出 SEC 费 0.00278%、FINRA TAF $0.000166/股（上限 $8.30），均可修改。

主要来源：[SEC](https://www.sec.gov/)、[Investor.gov](https://www.investor.gov/)、[FINRA](https://www.finra.org/)、[NYSE](https://www.nyse.com/)、[Nasdaq](https://www.nasdaq.com/)。

### 明确区分的易错点

1. K 线阳线（收盘 > 开盘）与当日涨跌幅（收盘 vs 昨收）可以给出相反结论。
2. `Low ≤ min(Open, Close) ≤ max(Open, Close) ≤ High` 是硬约束。
3. 一根 K 线无法还原周期内的价格路径。
4. 成交量是成交股数，不等于净买入。
5. 市值不是公司账户里的现金。
6. IPO 募资不是上市后的总市值；老股转让的钱不进公司。
7. 拆股不创造价值；增发会带来新股与摊薄，二者不是一回事。
8. A 股 T+1 回转限制 ≠ 美股 T+1 交收。
9. PE 不是固定回本年限；RSI 超卖不保证反弹。
10. 杠杆必须同时考虑债务、利息、维持担保比例与跳空/流动性。
11. 交易所规则、券商规则、账户条件不是同一层规则。
12. 模拟路径与收益不是预测，也不是投资建议。

---

## 技术架构

```text
stock-market-lab/
  build.py              标准库构建：内联 CSS/JS，输出单文件 index.html
  index.html            生成的离线交付物（随源码提交）
  src/
    page.html           页面骨架与内容区
    lab.css             设计系统、三栏实验台、响应式与浅色主题
    core.js             金融数学（Node/浏览器双用）
    market-rules.js     有日期的 A 股/美股规则与费用
    datasets.js         确定性模拟行情、预设、CSV/JSON 导入
    simulations.js      订单簿、IPO 需求、保证金、蒙特卡洛
    ui.js               参数面板控件与格式化
    charts.js           Canvas K 线/折线/柱状/环形图
    registry.js         模块注册表
    modules/            A–J 十个教学模块，各含 scenes/quiz/mount
    app.js              导航、自动导演、主题、进度、自测、规则表、导入
  tests/
    check-finance.cjs   金融不变量
    check-build.cjs     单文件离线封装与模块完整性
  work/                 开发期截图与临时脚本（不发布，git 忽略）
```

- 无框架、无打包器、无第三方运行时依赖；`build.py` 只做字符串内联与安全检查。
- 图表用 Canvas 2D + `devicePixelRatio` 缩放；SVG 用于 B1 的可拖拽 K 线编辑器。
- 每个模块通过 `SM.registerModule({...})` 注册，导演讲通过 `scenes[].patch` 驱动状态。
- 所有模块共享 `SM.charts`、`SM.ui`、`SM.core`；不允许在模块里硬编码与引擎冲突的公式。

---

## 构建、测试与发布

```sh
python3 build.py                 # 生成 index.html
node --check src/core.js         # 或循环检查 src/*.js src/modules/*.js
node tests/check-finance.cjs     # 38+ 条金融不变量
node tests/check-build.cjs       # 离线、无远程资源、10 个模块
git diff --check
```

CI 在 `.github/workflows/stock-market-lab.yml` 中执行上述构建、语法、金融与封装检查，并验证 `index.html` 已提交。Pages 工作流会先构建本项目，再由 `scripts/build_site.py` 复制到 `_site/stock-market-lab/`。

- 目标地址：<https://czl-homelab.github.io/Visualization-of-Science-and-Engineering/stock-market-lab/>（以实际部署为准）。
- 目录页条目：`site/projects.json`；预览图：`assets/stock-preview.svg`。

---

## 简化假设与已知限制

本站刻意把“能讲清楚”放在“完整仿真”之前。每个模块面板底部都列出了当页的模型边界，主要包括：

- 行情是模拟的，不含真实成交、复权、停牌、分红除权与盘口延迟。
- 订单簿是连续竞价的简化模型：只有限价/市价、价格优先/时间优先，没有隐藏单、冰山单、交易所撮合延迟与跨市场路由。
- IPO 需求曲线与配售是教学模型，不是询价预测；未模拟承销费、绿鞋、锁定期与老股转让细则。
- 杠杆模型按日计息、忽略税费与借券成本；维持担保比例、强平线、融资额度由券商与账户决定，页面参数可改。
- 蒙特卡洛假设收益率独立同分布（可选相关性），不保证真实分布；结果不是未来收益预期。
- ETF 模型忽略跟踪误差、折溢价动态、申赎套利与税；汇率只做简单折算。
- 规则只覆盖常见股票现货场景，不覆盖期权、期货、融资融券标的名单、北交所全部细则等。
- 未在真实 Safari/Firefox 设备上做逐项人工测试；已检查的浏览器与尺寸见发布报告。

---

## 第三方依赖与许可

本项目没有第三方运行时依赖，没有 CDN、在线字体、远程图片或 API。图标复用仓库根目录的 `assets/icon.svg`。代码与原创视觉使用 [MIT 许可](../../LICENSE)。引用到的交易所/SEC 页面仅作为规则来源链接，不复制其内容。

---

## English

**Stock Market Lab** is a fully offline, interactive teaching site about how stock markets actually work. Ten modules take a learner from a single candlestick to volume and indicators, order-book matching, A-share/US market rules, IPOs and capital actions, valuation, leverage and forced liquidation, ETFs and long-run investing, and finally ten synchronized comparisons.

Everything runs in the browser from one self-contained `index.html`; there is no backend, API key, CDN, web font or npm dependency. Built with plain HTML/CSS/JavaScript and Canvas/SVG. Market data is deterministic simulation and is labelled as such. Rule constants carry an `asOf` date (currently **2026-10-31**) and cite official sources; they can change.

Build and test:

```sh
python3 build.py
node tests/check-finance.cjs
node tests/check-build.cjs
python3 -m http.server 8766
```

The project is MIT licensed and is not investment advice. Model boundaries are listed in each module and in the section above.

---

*规则核对：2026-10-31 · 构建与测试记录见 CI 与发布说明。*
