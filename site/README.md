# 项目目录 / Project directory

## 中文

`index.template.html` 是站点根地址的目录模板，`projects.json` 是项目清单。首页不是 Motor Lab 的重定向页，新项目通过清单加入。

增加项目时：

1. 在 `Projects/<slug>/` 提供可发布的 `index.html`，补齐双语 README、构建与检查说明。
2. 在清单中填写唯一的短横线 slug、标题、类别、中英文介绍、标签、指标与预览图相对路径。
3. 构建项目后，从仓库根目录运行 `python scripts/check_site.py`。
4. 使用 `python -m http.server 8767 --bind 127.0.0.1 --directory _site` 检查目录、项目链接和窄屏。

构建器只发布清单中的项目、根目录网页及共享 assets；不会上传源码或 work 目录。当前每个项目按单文件 HTML 打包，依赖额外文件的新项目需要明确扩展 `scripts/build_site.py`。GitHub Actions 在干净检出中构建；本地 `_site` 是被忽略的中间目录。

## English

`index.template.html` defines the root catalog and `projects.json` is its explicit registry. The homepage is a directory, not a redirect to Motor Lab.

To add a project, provide a publishable `Projects/<slug>/index.html` and bilingual documentation, register a unique kebab-case slug with title, category, Chinese/English descriptions, tags, metrics and preview path, then build the project and run `python scripts/check_site.py` from the repository root. Preview with the server command above and check routes and narrow layouts.

The builder publishes only registered project artifacts, the homepage and shared assets, excluding source and work folders. Projects are currently packaged as standalone HTML; extend `scripts/build_site.py` explicitly for additional dependencies. Actions builds from a clean checkout; local `_site` is ignored intermediate output.
