# 项目目录 / Project directory

## 中文

`index.template.html` 是站点根地址的目录模板，`projects.json` 是项目清单。首页不是 Motor Lab 的重定向页，新项目通过清单加入。

根目录页与各实验室共用 `czl-lab-theme` 主题偏好：首次绘制前设置 `data-theme`，无记录时跟随系统，右上角按钮切换并持久化；主题逻辑来自 `assets/theme.js`，模板的 `THEME_BOOT` 与 `SHARED_EXPERIENCE` 占位符由 `scripts/shared_experience.py` 在目录构建时替换；深浅色样式与入场资源均内联，不依赖远程资源。每个实验室顶栏返回 `Lab Projects`，页脚前列出全部实验室；新增项目时同步更新介绍文字、所有实验室目录和相关文档，不只更新新项目本身。

入场、跳过/回放、减少动态效果与“跟随系统”恢复入口与所有 Lab 使用同一实现；添加新 Lab 时同步 `scripts/shared_experience.py` 的配置与 `assets/entry.js` 的学科图形，并检查首次绘制、深浅主题与窄屏。

增加项目时：

1. 在 `Projects/<slug>/` 提供可发布的 `index.html`，补齐双语 README、AGENTS、构建与检查说明。
2. 在清单中填写唯一的短横线 slug、标题、类别、中英文介绍、标签、指标与预览图相对路径。
3. 更新所有 Lab 目录、根 README、相关贡献指南、CHANGELOG 与 [交接记录](../docs/HANDOFF.md)，以及新项目 CI 和 Pages 构建/检查步骤。
4. 构建项目后，从仓库根目录运行 `python scripts/check_site.py`。
5. 使用 `python -m http.server 8767 --bind 127.0.0.1 --directory _site` 检查目录、项目链接和窄屏。

构建器只发布清单中的项目、根目录网页及共享 assets；不会上传源码或 work 目录。当前每个项目按单文件 HTML 打包，依赖额外文件的新项目需要明确扩展 `scripts/build_site.py`。GitHub Actions 在干净检出中构建；本地 `_site` 是被忽略的中间目录。`check_site.py` 还会核对每个 Lab 的目录恰好覆盖清单全部项目，并只将自身标记为当前页。仅执行目录打包不会构建 Lab 源码，必须先完成项目构建。

## English

`index.template.html` defines the root catalog and `projects.json` is its explicit registry. The homepage is a directory, not a redirect to Motor Lab.

The catalog shares the `czl-lab-theme` preference with every lab: `data-theme` is set before first paint, the system preference is the fallback, and the header button persists explicit choices. assets/theme.js supplies the theme controller. scripts/shared_experience.py replaces THEME_BOOT and SHARED_EXPERIENCE hooks during the catalog build, inlining theme/entrance scripts and styles without remote assets. Each lab links back to `Lab Projects` and lists all labs above its footer; update every lab directory and affected documentation when adding a project, not only the new lab.

Entrance, skip/replay, reduced motion and the system-theme reset share the lab implementation. Register new lab configuration in scripts/shared_experience.py and its subject motif in assets/entry.js; check first paint, both themes and narrow layouts.

To add a project, provide a publishable `Projects/<slug>/index.html`, bilingual README/AGENTS and build/test guidance, register a unique kebab-case slug with title, category, Chinese/English descriptions, tags, metrics and preview path, update every lab directory, root README, applicable contributor guidance, CHANGELOG and [handoff](../docs/HANDOFF.md), and add CI/Pages build and check steps. Then build the project and run `python scripts/check_site.py` from the repository root. Preview with the server command above and check routes and narrow layouts.

The builder publishes only registered project artifacts, the homepage and shared assets, excluding source and work folders. Projects are currently packaged as standalone HTML; extend `scripts/build_site.py` explicitly for additional dependencies. Actions builds from a clean checkout; local `_site` is ignored intermediate output. `check_site.py` also verifies that each lab directory covers the complete registry once and marks only itself current. Catalog packaging does not build lab source; build project artifacts first.
