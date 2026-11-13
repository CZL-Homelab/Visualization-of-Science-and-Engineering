# 视觉标识 / Visual identity

## 中文

- `icon.svg`：仓库的原始 SVG 标识，128 × 128 视口，可无损缩放。灰白等轴测框架表示工程结构，前后分层的蓝色轨道表示观察和运动，短青色边与铜色焦点只作点缀。16–32px 隐去次要后轨道并加粗线条；维持 128 × 128 视口和石墨底，不通过整图反色适配主题。
- 目录预览图：`motor-preview.svg`（电机横截面）、`stock-preview.svg`（K 线与订单簿）、`desal-preview.svg`（RO 与整厂水路）、`fusion-preview.svg`（托卡马克与热电转换）、`distillation-preview.svg`（板式精馏塔与 McCabe–Thiele 图）。均为说明性插图，不是工程仿真结果。预览路径与替代文本登记在 `site/projects.json`，新增或更名时同步此说明及项目清单。
- README 与站点使用同一标识；目录以相对路径引用，所有实验室构建时内嵌为 data URI，以保持单文件离线运行。
- `theme.js`：首次绘制前和运行时的唯一主题控制器，处理系统默认、手动持久化、恢复自动、旧键迁移及跨页面同步。
- `entry.js` / `entry.css`：目录及各 Lab 的有限入场、跳过、回放、减少动态效果和页脚恢复系统主题入口。通过 `scripts/shared_experience.py` 内嵌；不改为运行时远程资源。
- 原始图形使用仓库 MIT 许可。可以复制 SVG 作为其他演示或文档的标识，但请保持长宽比和小尺寸下的可读性。
- GitHub 仓库没有独立头像上传功能。本标识通过 README 识别项目；它不代表更改 CZL-Homelab 的组织头像。

## English

- `icon.svg` is the original repository emblem with a scalable 128 × 128 viewBox. The gray/white isometric frame represents structure; the depth-ordered blue orbit represents observation/motion, with a short cyan edge and copper focal point. At 16–32px, hide the secondary rear orbit and strengthen strokes. Preserve the 128 × 128 viewBox and graphite base rather than inverting the entire image for a theme.
- Catalog previews are `motor-preview.svg` (motor cross-section), `stock-preview.svg` (candlesticks/order book), `desal-preview.svg` (RO/plant streams) `fusion-preview.svg` (tokamak/thermal conversion) and `distillation-preview.svg` (tray column and McCabe–Thiele diagram). They are explanatory illustrations, not engineering simulation results. Register preview paths and alt text in `site/projects.json`, keeping this inventory current when adding or renaming assets.
- The README and website share this identity. The directory references it relatively; all labs embed it as a data URI to preserve standalone offline operation.
- `theme.js` is the shared pre-paint/runtime controller for system defaults, manual persistence, automatic reset, legacy migration and same-origin synchronization.
- `entry.js` / `entry.css` implement the finite catalog/lab entrance, skip/replay, reduced motion and footer system-theme control. scripts/shared_experience.py embeds them; do not replace them with remote runtime resources.
- Original graphics use the repository's MIT license. Reuse the SVG in related demonstrations or documentation while preserving its aspect ratio and small-size readability.
- GitHub does not provide a separate repository-avatar upload setting. This emblem identifies the project in its README and website; it does not change the CZL-Homelab organization avatar.
