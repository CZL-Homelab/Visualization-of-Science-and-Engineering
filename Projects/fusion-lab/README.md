# 核聚变反应堆实验室 · Fusion Lab

7 章、41 幕交互讲解：氘氚反应、磁约束、ITER 装置解剖、一次放电、能量平衡、氚燃料循环与聚变电站。三维模型支持旋转、缩放、剖切与零件选择；讲解与动效可以暂停，默认尊重减少动态效果偏好。不默认播放语音。

## 构建与验证 / Build and verify

需要 Python 3.9+ 与 Node.js 22+，不需要安装依赖。在本目录运行：

```sh
python3 build.py
node tests/check-physics.cjs
node tests/check-build.cjs
```

修改 `src/` 后重新生成并提交 `index.html`。生成页内嵌 Three.js、样式、脚本与图标，可直接从 `file://` 离线打开。完整站点导航需保留目录结构；从仓库根目录运行 `python3 scripts/check_site.py`，再用 `python3 -m http.server 8767 --bind 127.0.0.1 --directory _site` 预览。

## 模型与来源 / Models and sources

`src/core.js` 集中管理反应质量亏损、Bosch–Hale 热反应率、零维能量平衡、回旋运动、圆柱安全因子近似、氚三库存模型与电站功率记账。图形中的粒子、磁力线、脉冲与设备布局都是教学示意，不是工程仿真。温度与密度剖面、输运、磁流体稳定性、材料损伤与完整工厂经济性未求解。ITER 不发电；其设计目标与电站净电输出必须区分。路线图日期是引用来源的计划，不是已实现的结果。

页面“数字口径”列出来源、核对日期及简化边界；外部参考链接需要联网，实验台运行不需要。保留仓库 MIT 许可与 `vendor/THREE-LICENSE.txt` 中的 Three.js 署名。

## English

Seven chapters and 41 scenes explain D–T fusion, confinement, ITER anatomy, pulse operation, power balance, tritium inventories and power plants. Rotate and inspect the 3D machine, adjust instruments, or use the pausable guided tour. Reduced motion is respected by default; speech does not autoplay.

Run the commands above with Python 3.9+ and Node.js 22+. No package installation is required. Edit `src/`, rebuild, and commit the generated `index.html` together with source. All runtime assets are embedded for offline `file://` use; retain the complete site layout for cross-lab navigation.

The physics is a teaching model: flat profiles and zero-dimensional power balance, approximate safety factor, a three-reservoir tritium inventory, and a plant power ledger. Particle motion, magnetic lines, geometry and pulse traces are illustrative, not engineering simulations. ITER performance figures are design targets; it does not generate electricity. Roadmap dates are attributed plans. The reference section lists sources and boundaries. External reference links require a connection; the lab itself does not. Preserve the repository MIT license and the vendored Three.js license.

## 入场与主题特性 / Entrance and theme features

进入本 Lab 时显示简短的磁约束入场动效，约 1.6 秒自动结束。可立即跳过，顶栏可回放；鼠标/键盘操作或页面隐藏会清理入场，锚点链接直接进入目标内容。系统“减少动态效果”会跳过入场并禁用回放。共享 Logo、主题及动效在构建时内嵌，保持离线使用；下载后重开不重复生成按钮。

默认跟随系统浅色/暗黑偏好，手动选择记入 `czl-lab-theme`；没有手动覆盖时跟随系统实时变化。同源页面同步主题，页脚“主题：跟随系统”恢复自动模式。不是按本地时钟强制切换。公共维护约定见 [根 AGENTS](../../AGENTS.md)，实现入口见 [资源说明](../../assets/README.md)。

The short magnetic confinement entrance ends automatically in about 1.6 seconds. Skip immediately or replay from the header; pointer/keyboard interaction or hiding the page clears it, and deep links open directly. Reduced motion bypasses the entrance and disables replay. Logo/theme/entrance assets are embedded offline at build time; reopening a downloaded snapshot does not duplicate controls.

Theme follows the system's light/dark setting until a manual choice is saved under czl-lab-theme. Unoverridden pages follow live system changes, same-origin pages synchronize, and the footer system-theme button restores automatic mode. There is no forced day/night clock rule. See root AGENTS and asset guidance linked above for shared maintenance.
