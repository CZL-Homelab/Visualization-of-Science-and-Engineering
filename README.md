# 科学与工程可视化 · Visualization of Science and Engineering

用交互模型、动画、字幕和对照实验，把科学与工程中的结构、因果关系和工作过程讲清楚。项目由 **CZL-Homelab** 组织维护，欢迎开发者、内容作者和 AI 辅助贡献。

- **唯一主仓库**：[CZL-Homelab/Visualization-of-Science-and-Engineering](https://github.com/CZL-Homelab/Visualization-of-Science-and-Engineering)
- **网站入口**：[组织 GitHub Pages](https://czl-homelab.github.io/Visualization-of-Science-and-Engineering/)
- **当前项目**：[Motor Lab 电机原理实验室](https://czl-homelab.github.io/Visualization-of-Science-and-Engineering/motor-lab/)
- **开始贡献**：[CONTRIBUTING.md](CONTRIBUTING.md) · **AI 工作约定**：[AGENTS.md](AGENTS.md)

后续代码、Issue、PR 和部署均以组织仓库为准。个人账号下的历史仓库和旧站点不是后续同步或发布目标。

## 当前演示

| 项目 | 内容 | 源码与说明 |
| --- | --- | --- |
| Motor Lab | 六类电机，精细三维分解，48 幕课程，自动运镜字幕，四组双模型对比 | [Projects/motor-lab](Projects/motor-lab) |

Motor Lab 默认先展示运行动画，再进入逐步讲解。它支持单文件离线运行；可选系统语音及外部参考资料的联网需求见项目说明。几何、场线和工作点属于教学模型，具体边界见各项目文档。

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
```

请修改 `src/`，再重新生成 `index.html`。不要只编辑生成页。新增演示放在 `Projects/<slug>/`，提供独立说明、构建和检查方式，并在发布工作流中明确增加对应路由。

## 协作与发布

日常开发使用功能分支和 PR；PR 会执行独立 CI。合并到组织仓库的 `main` 后，Pages 工作流构建、验证并部署。文档和发布配置变化也会触发发布，支持从 Actions 手动运行。

站点位于 `czl-homelab.github.io/Visualization-of-Science-and-Engineering/`，不是组织根域的独立首页仓库。当前站点根路径跳转至 `/motor-lab/`。发布仅上传生成的网页，不上传源码、备份或工作文件。

仓库管理员应将 **Settings → Pages → Source** 设为 **GitHub Actions**。新维护者可在 [Actions](https://github.com/CZL-Homelab/Visualization-of-Science-and-Engineering/actions) 查看检查和部署记录。现有流程使用仓库提供的 `GITHUB_TOKEN`，不需要在源码中保存个人令牌。

MIT 许可见 [LICENSE](LICENSE)。第三方依赖保留各自许可证，例如 [Three.js MIT 许可](Projects/motor-lab/vendor/THREE-LICENSE.txt)。现有作者署名保持不变。
