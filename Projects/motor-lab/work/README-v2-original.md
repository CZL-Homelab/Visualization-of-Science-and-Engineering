# 电机原理 3D 实验室 · 离线版 v2.0

## 如何使用

直接双击 `index.html`，用 Chrome、Edge、Firefox 或 Safari 打开即可。
不需要服务器、账号、网络、Node.js 或任何安装步骤。所有代码、三维模型和样式都包含在网页中。
外部的原厂参考资料链接需要联网访问，其余教学功能可以离线使用。

## 内容

1. 三相六步换相 BLDC：定子绕组、永磁转子、六步电流与磁场指针。
2. 有刷直流：固定电刷、旋转换向器、转子绕组和机械换向。
3. 正弦驱动永磁同步：三相电流、旋转磁场与负载角。
4. 三相鼠笼异步：导条、短路环、感应与转差。
5. 单相电容运转：主副绕组、错相电流与椭圆磁场。
6. 罩极：闭合铜环、局部磁通滞后与启动方向。
7. 损耗账本：总效率、轴输出、输入功率、损耗与 8 小时耗电。
8. 分类对照、风机相似定律、误区问答与原厂延伸资料。

## 操作

- 鼠标拖动 / 单指拖动：旋转三维视角。
- 滚轮：缩放模型。选择“复位视角”可恢复默认视角。
- 空格：暂停 / 继续，光标在按钮或表单上时遵循其正常操作。
- 模型获得键盘焦点后，方向键也可改变视角。
- 步进 60°：暂停并推进一个电角度区间。
- “动手实验”课程中的 BLDC 六个按钮：跳至指定换相状态。
- 拆解距离：将定子、转子、端盖与换向器沿轴向展开。
- 前端剖开：隐藏前端盖并展示部分剖面。
- 显示风扇叶片：显示机械输出端叶轮，不自动施加空气动力学负载。
- 电气频率、等效电压指令、轴端负载：改变教学工作点。

## 模型的物理边界

- 三维模型是程序生成的简化几何，采用透视投影与深度排序渲染；不是制造级 CAD 或有限元结果。
- 统一用两极、内转子模型便于对照。真实风扇可能使用多极、外转子、单相或两相无刷驱动。
- 所有转速均为简化稳态教学值；动画大幅慢放，不与屏幕标注 rpm 按真实时间同步。
- 三相 / 单相感应模型的转差使用随负载线性变化的示意关系，不是真实转矩曲线；未模拟启动、堵转、饱和、失步或惯量。
- BLDC 六步磁场跳变，转子平滑跟随。跟随角为设定示意量，不是实时求解的电磁转矩角。
- PMSM 的负载角采用简化示意，不代替实际 d/q 轴模型或磁阻转矩分析。
- 电容电机取相位差 70°、幅值比 0.8 作示意；真实值由绕组、电容与工况决定。
- 罩极模型显示局部磁通时序，不把罩极磁场画成理想三相圆形旋转磁场。
- 损耗账本的效率由用户假定，各损耗比例是示例；不预测真实电机效率、外壳温度或绕组温度。
- 电机轴输出功率不等于有效空气功率。按同风量比较整机能耗更有意义。

## 文件与修改

- `index.html`：完整离线网站，同时包含全部 HTML / CSS / JavaScript，打开文本编辑器即可修改。
- `README.md`：本说明。
- 不使用外部 JavaScript、字体、图片或 CDN；不请求任何用户数据。

2026-10-28

## English — archived v2 instructions

This file preserves the original Chinese v2 README above as historical documentation. It is not the current source of truth. Open the parent README and AGENTS.md for v3.1, organization publishing and current controls.

The v2 page was a standalone offline canvas-projected motor lab covering six-step BLDC, brushed DC, sinusoidal permanent-magnet synchronous, three-phase induction, capacitor-run and shaded-pole motors, plus loss arithmetic, taxonomy and fan laws. Drag to rotate, scroll to zoom, Space to pause, arrow keys to change view, and step 60 electrical degrees. Sliders controlled frequency/voltage, load and exploded separation. Optional labels, sectioning and fan blades illustrated parts and output.

The original models were simplified two-pole internal-rotor geometries with slowed, prescribed steady-state motion. Slip was linear in load, BLDC following and PMSM magnetic-axis angles were illustrative, capacitor phase/amplitude were 70 degrees/0.8, and shaded-pole flux used local timing. They did not solve startup, inertia, stall, saturation, overload, temperature, real efficiency or aerodynamic loads. The old index.html contained all code and no CDN dependencies; reference links required connectivity. These historical constraints explain the archive and are not instructions to restore or replace the current implementation.
