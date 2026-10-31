<p align="center"><img src="assets/icon.svg" width="96" height="96" alt="CZL 科学与工程可视化 / Science and Engineering Visualizations"></p>

# 科学与工程可视化 · Visualization of Science and Engineering

用交互模型、动画、字幕和对照实验，把科学与工程中的结构、因果关系和工作过程讲清楚。项目由 **CZL-Homelab** 组织维护，欢迎开发者、内容作者和 AI 辅助贡献。

- **唯一主仓库**：[CZL-Homelab/Visualization-of-Science-and-Engineering](https://github.com/CZL-Homelab/Visualization-of-Science-and-Engineering)
- **网站入口**：[组织 GitHub Pages](https://czl-homelab.github.io/Visualization-of-Science-and-Engineering/)
- **当前项目**：[Motor Lab 电机原理实验室](https://czl-homelab.github.io/Visualization-of-Science-and-Engineering/motor-lab/) · [Stock Market Lab 股票市场原理实验室](https://czl-homelab.github.io/Visualization-of-Science-and-Engineering/stock-market-lab/)
- **开始贡献**：[CONTRIBUTING.md](CONTRIBUTING.md) · **AI 工作约定**：[AGENTS.md](AGENTS.md)

后续代码、Issue、PR 和部署均以组织仓库为准。个人账号下的历史仓库和旧站点不是后续同步或发布目标。

## 当前演示 / Current projects

| 项目 | 内容 | 源码与说明 |
| --- | --- | --- |
| Motor Lab | 六类电机，精细三维分解，48 幕课程，自动运镜字幕，四组双模型对比 | [Projects/motor-lab](Projects/motor-lab) |
| Stock Market Lab | 10 个模块、60+ 幕讲解：K 线与周期聚合、成交量与技术指标、订单簿撮合、A 股/美股制度、IPO、估值、杠杆、ETF 与 10 组同步对比 | [Projects/stock-market-lab](Projects/stock-market-lab) |

Motor Lab 默认先展示运行动画，再进入逐步讲解。它支持单文件离线运行；可选系统语音及外部参考资料的联网需求见项目说明。几何、场线和工作点属于教学模型，具体边界见各项目文档。

Stock Market Lab 面向没有金融基础的学习者：从一根 K 线的四个价格出发，逐层拆到订单簿、一级/二级市场资金流、IPO 摊薄、估值、杠杆强平与 ETF 分散。所有行情与收益都是标注过的模拟数据或固定种子模型；规则页记录核对日期与官方来源，不构成投资建议。

## 快速开始

需要 Git、Python 3.9+ 和 Node.js 22 LTS。当前项目不需要 npm 安装或 Python 第三方包。

```sh
git clone https://github.com/CZL-Homelab/Visualization-of-Science-and-Engineering.git
cd Visualization-of-Science-and-Engineering/Projects/motor-lab
python build.py
node tests/check-model.cjs
python -m http.server 8766 --bind 127.0.0.1
```

打开 `http://127.0.0.1:8766/` 预览；停止服务使用 Ctrl+C。也可直接用支持 WebGL 的现代浏览器打开生成的 `index.html`。Linux/macOS 若没有 `python` 命令，可使用 `python3`。

已有本地工程可确认并更新远程：

```sh
git remote -v
git remote set-url origin https://github.com/CZL-Homelab/Visualization-of-Science-and-Engineering.git
git fetch origin
```

请先检查工作区和分支历史，再同步代码；不要使用强推或覆盖他人的未提交改动。

## 仓库结构

```text
.github/                 CI、Pages 发布、Issue 与 PR 模板
assets/                  SVG 标识与共享插图
site/                    目录模板与项目清单
scripts/                 目录构建及链接检查
AGENTS.md                仓库级 AI 工作约定
CONTRIBUTING.md          开发、验证与协作流程
CHANGELOG.md             面向使用者的更新记录
Projects/
  motor-lab/
    AGENTS.md            电机模型和状态管理的专门约定
    src/                 应修改的页面、样式和脚本源码
    vendor/              固定版本依赖及其许可证
    tests/               物理关系与离线封装检查
    build.py             将源码组装为单文件网页
    index.html           生成的离线交付文件，随源码一起提交
  stock-market-lab/
    AGENTS.md            金融模型、规则版本与教学边界约定
    src/                 页面、样式、共享计算引擎与 10 个模块
    tests/               金融不变量与离线封装检查
    build.py             将源码组装为单文件网页
    index.html           生成的离线交付文件，随源码一起提交
```

请修改 `src/`，再重新生成 `index.html`。不要只编辑生成页。新增演示放在 `Projects/<slug>/`，提供独立说明、构建和检查方式，并在 `site/projects.json` 登记项目；构建器据此生成目录和对应路由。若项目需要额外资源，请同时扩展打包逻辑。

## 协作与发布

日常开发使用功能分支和 PR；PR 会执行独立 CI。合并到组织仓库的 `main` 后，Pages 工作流构建、验证并部署。文档和发布配置变化也会触发发布，支持从 Actions 手动运行。

站点位于 `czl-homelab.github.io/Visualization-of-Science-and-Engineering/`，不是组织根域的独立首页仓库。站点根路径是可搜索的项目目录，Motor Lab 保留 `/motor-lab/`，Stock Market Lab 使用 `/stock-market-lab/`。发布仅上传生成的网页，不上传源码、备份或工作文件。

仓库管理员应将 **Settings → Pages → Source** 设为 **GitHub Actions**。新维护者可在 [Actions](https://github.com/CZL-Homelab/Visualization-of-Science-and-Engineering/actions) 查看检查和部署记录。现有流程使用仓库提供的 `GITHUB_TOKEN`，不需要在源码中保存个人令牌。

MIT 许可见 [LICENSE](LICENSE)。第三方依赖保留各自许可证，例如 [Three.js MIT 许可](Projects/motor-lab/vendor/THREE-LICENSE.txt)。现有作者署名保持不变。

## 目录与视觉标识 / Directory and visual identity

根地址是项目总目录，后续演示统一登记在 `site/projects.json`，不再用某一个演示代替首页。构建目录：先构建各演示，再在仓库根目录运行 `python scripts/check_site.py`；本地预览使用 `python -m http.server 8767 --bind 127.0.0.1 --directory _site`。

SVG 标识位于 [`assets/icon.svg`](assets/icon.svg)：空间框架表示结构，轨迹表示科学观察和运动。README、目录及 Motor Lab 使用同一标识；Motor Lab 内嵌 SVG，保持离线使用。网站头部和页脚提供完整仓库入口。图标与复用说明见 [`assets/README.md`](assets/README.md)。

## English

### Purpose and canonical home

An open collection of interactive science and engineering explanations maintained by **CZL-Homelab**. Explore structures, causal relationships and working principles through models, animation, captions and comparisons.

- Canonical repository: [CZL-Homelab/Visualization-of-Science-and-Engineering](https://github.com/CZL-Homelab/Visualization-of-Science-and-Engineering).
- Project directory: [GitHub Pages](https://czl-homelab.github.io/Visualization-of-Science-and-Engineering/).
- Current demonstrations: [Motor Lab](https://czl-homelab.github.io/Visualization-of-Science-and-Engineering/motor-lab/) (six motor types, 48 lesson scenes, 24 comparison scenes) and [Stock Market Lab](https://czl-homelab.github.io/Visualization-of-Science-and-Engineering/stock-market-lab/) (ten interactive labs on candlesticks, indicators, order books, market rules, IPOs, valuation, leverage and ETFs).
- Read [CONTRIBUTING.md](CONTRIBUTING.md) and the applicable [AGENTS.md](AGENTS.md) before contributing. Personal historical repositories and sites are not synchronization or deployment targets.

### Run and build

Use Git, Python 3.9+ and Node.js 22 LTS. No npm installation or third-party Python packages are needed. Clone the organization repository, enter `Projects/motor-lab` or `Projects/stock-market-lab`, then run `python build.py` and the project's Node test (`node tests/check-model.cjs` or `node tests/check-finance.cjs`). The commands in the Chinese quick-start section are identical on all platforms; use `python3` where appropriate.

Preview the project with `python -m http.server 8766 --bind 127.0.0.1`, or open its generated `index.html` with a WebGL-capable browser. Optional speech and external references have their own network requirements; see the project README. Models are educational and disclose physical simplifications.

To build the complete directory, build project artifacts first, then run `python scripts/check_site.py` from the repository root. Preview `_site` with `python -m http.server 8767 --bind 127.0.0.1 --directory _site`. The root page is a searchable catalog; each project has its own stable route such as `/motor-lab/`.

### Source, identity and collaboration

Edit project `src/` files and regenerate `index.html`; commit both source and the documented generated deliverable. `site/` contains the directory template and project registry, `assets/` holds shared SVG identity and illustrations, and `scripts/` builds and verifies the published directory. Add new demonstrations under `Projects/<slug>/` and register them in `site/projects.json` (including `previewAlt`); extend packaging explicitly if they require extra assets.

The [SVG icon](assets/icon.svg) combines a spatial frame with an orbital path, representing structure, observation and motion. It is used in this README, the directory, and the Motor Lab favicon/brand. Motor Lab embeds it to retain offline operation. Both web pages link to the complete repository name. See [asset guidance](assets/README.md).

Use feature branches and pull requests. CI verifies Windows and Linux builds, JavaScript syntax, physical invariants, generated artifacts and published links. Merging to the organization's `main` triggers Pages deployment; manual dispatch is also supported. Pages Source must be **GitHub Actions**. Publishing uses `GITHUB_TOKEN`, not committed personal credentials. The root page is not the organization's separate `<owner>.github.io` repository.

Before changing the remote or synchronizing existing work, inspect the working tree, branch history and `git remote -v`. Do not overwrite collaborators' changes or force-push. See [Actions](https://github.com/CZL-Homelab/Visualization-of-Science-and-Engineering/actions) for actual deployment status.

Code and original visual identity use the [MIT license](LICENSE); preserve existing author attribution and third-party licenses, including [Three.js](Projects/motor-lab/vendor/THREE-LICENSE.txt).
