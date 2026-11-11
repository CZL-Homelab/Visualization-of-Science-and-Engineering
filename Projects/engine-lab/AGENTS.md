# Engine Lab — AI 工作约定

- `src/core.js` 只放纯模型函数，禁止 DOM / Canvas；模型改动必须同步 `tests/check-model.cjs`。
- `src/engine-render.js` 是唯一渲染出口：新仪器先加渲染函数，再在 `src/app.js` 的 tool 分发里登记。
- 每个 `src/modules/*.js` 注册且只注册一个模块（`registerModule`），场景必须带 `key`、`narr`，测验必须给 `why`。
- 场景默认走共享 `engine` 工具；需要新画法时传 `tool`，不要在模块文件里直接画。
- 构建产物 `index.html` 必须随源码一起提交；`python build.py && node tests/check-model.cjs && node tests/check-build.cjs` 全绿才算完成。
- 页面不得引入远程资源；主题键固定 `czl-lab-theme`；导航目录与 `site/projects.json` 保持一致。
- 模型边界（γ、配气角度、爆震极限）是教学值，改动要在 README「模型边界」同步说明。
