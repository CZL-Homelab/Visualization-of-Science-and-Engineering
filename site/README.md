# 项目目录 / Project directory

## 中文

`index.template.html` 是站点根地址的目录模板，`projects.json` 是项目清单。首页不是 Motor Lab 的重定向页，新项目通过清单加入。

根目录页与各实验室共用 `czl-lab-theme` 主题偏好：首次绘制前设置 `data-theme`，无记录时跟随系统，右上角按钮切换并持久化；目录页的浅色与深色样式都在 `index.template.html` 内联，不依赖远程资源。每个实验室顶栏返回 `Lab Projects`，页脚前列出全部实验室；新增项目时同步更新介绍文字与该项目自己的目录。

增加项目时：

1. 在 `Projects/<slug>/` 提供可发布的 `index.html`，补齐双语 README、构建与检查说明。
2. 在清单中填写唯一的短横线 slug、标题、类别、中英文介绍、标签、指标与预览图相对路径。
3. 构建项目后，从仓库根目录运行 `python scripts/check_site.py`。
4. 使用 `python -m http.server 8767 --bind 127.0.0.1 --directory _site` 检查目录、项目链接和窄屏。

构建器只发布清单中的项目、根目录网页及共享 assets；不会上传源码或 work 目录。当前每个项目按单文件 HTML 打包，依赖额外文件的新项目需要明确扩展 `scripts/build_site.py`。GitHub Actions 在干净检出中构建；本地 `_site` 是被忽略的中间目录。

## English

`index.template.html` defines the root catalog and `projects.json` is its explicit registry. The homepage is a directory, not a redirect to Motor Lab.

The catalog shares the `czl-lab-theme` preference with every lab: `data-theme` is set before first paint, the system preference is the fallback, and the header button persists explicit choices. Both palettes are inlined in `index.template.html` with no remote assets. Each lab links back to `Lab Projects` and lists all labs above its footer; keep that directory in sync when adding a project.

To add a project, provide a publishable `Projects/<slug>/index.html` and bilingual documentation, register a unique kebab-case slug with title, category, Chinese/English descriptions, tags, metrics and preview path, then build the project and run `python scripts/check_site.py` from the repository root. Preview with the server command above and check routes and narrow layouts.

The builder publishes only registered project artifacts, the homepage and shared assets, excluding source and work folders. Projects are currently packaged as standalone HTML; extend `scripts/build_site.py` explicitly for additional dependencies. Actions builds from a clean checkout; local `_site` is ignored intermediate output.
