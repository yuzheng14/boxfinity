# Boxfinity 工作约定

## 项目与命令

- Vite 构建的纯静态 ES 模块应用，Node.js >= 22.12。源码使用 TypeScript（strict），界面使用已批准的 `react@^19.3.1`、`react-dom@^19.3.1`；3D 使用 `three@^0.187.0` 及同包 OrbitControls；构建依赖为 `vite@^8.3.7`、`@vitejs/plugin-react@^6.3.0`。类型检查依赖 `typescript@^7.0.2`、`@types/react@^19.3.0`、`@types/react-dom@^19.3.0`、`@types/three@^0.187.0`；这些版本范围、正常传递依赖及 TypeScript 平台二进制已获批准。
- 引入或更新任何外部依赖、临时工具、CDN 或 CI Action 前，说明名称、版本、用途、取舍、替代方案及传递依赖，并取得人类明确批准。安装锁文件中已有依赖无需重复审批。
- `npm ci` 安装现有锁定依赖；`npm run dev` 开发；`npm test` 验证；`npm run typecheck` 严格类型检查；`npm run build` 先检查类型再生成 `dist/`；`npm run preview` 验证构建。
- `dist/`、`node_modules/` 和 `artifacts/` 是本地或生成内容，不提交。
- 入口为根目录 `index.html`，源码放在 `src/`，原样发布的静态资源放在 `public/`；Vite 配置保留 Pages 子路径，其余优先使用默认值。
- 保留根目录 MIT LICENSE，以及构建输出中的第三方许可证声明（由 Vite 内置功能写入 `dist/THIRD_PARTY_LICENSES.md`）。
- 已批准的官方 CI Actions：checkout@v7.0.1、setup-node@v7.1.0、configure-pages@v6.0.0、upload-pages-artifact@v5.0.0、deploy-pages@v5.0.1，以及它们的打包依赖和 upload-artifact@v7.0.0。完整提交 SHA 见 `.github/workflows/ci-pages.yml`。新增或升级仍须审批。
- PR 只测试和构建，main 构建成功后自动发布 Pages；部署写权限只放在独立 deploy job，不使用 pull_request_target 执行 PR 代码。

## 多会话协作

- 每个会话使用独立 Git worktree 和功能分支；不要在共享工作目录切换分支或改写其他会话的文件。
- 开始前执行 `git status`，说明本次负责的功能与文件范围。提交保持单一目标，避免夹带其他会话的变更。
- 例：`git fetch origin`，然后 `git worktree add ../boxfinity-<任务名> -b feat/<任务名> origin/main`。
- 各 worktree 单独安装锁定依赖，可用 `npm run dev -- --port 5175` 指定端口；默认端口占用时 Vite 自动顺延。不要停止其他会话的服务。
- 通过 PR 合入 main，不覆盖远端历史。相互独立的任务分别开 PR；存在依赖的多层 PR 按 GitHub 原生 Stacked PR 约定组织，明确各层增量与审查顺序。
- PR 描述写清问题、变更范围、验证结果和具体 review 重点。UI 变更必须在对应 PR 评论中实际上传运行界面的截图，确认图片可见并提供评论链接；本地路径不算完成。

## TypeScript 与 React 组件边界

- 应用代码使用 `.ts` / `.tsx`，保留 `strict` 与 `erasableSyntaxOnly`。共享尺寸、布局、零件和打印结果契约放在 `types.ts`，视图契约放在 `view-types.ts`；外部 JSON 使用 `unknown` 并经运行时校验。不要通过 `any`、`@ts-ignore` 或关闭检查绕过错误。
- `App.tsx` 组合应用；`use-editor.ts` 处理表单草稿与持久化；`editor.ts` 管理已验证设计、历史及选择。输入中的无效参数不得覆盖有效方案或 localStorage 草稿。
- `components/` 分别负责参数、测量浮层、盒子列表、三维视口与弹窗。表单和列表由 React 渲染，不恢复全局 DOM 查询及手工替换。
- `PreviewWorkspace.tsx` 通过 ref 管理 Three.js 实例。React 不管理其 canvas / SVG 标注子树；卸载时移除事件监听、断开 ResizeObserver、dispose OrbitControls 和渲染资源。保留 StrictMode 的重复挂载检查。
- 保持 v2 方案文件和 `boxfinity.cabinet.v2` 草稿兼容。框架迁移不改变几何、打印方向或 3MF 坐标。

## 模型与交互边界

- 柜体正面网格的列对应宽、行对应高，行从上往下；深度独立。
- `geometry.ts` 的规范网格与 `printing.ts` 的打印变换由预览和 3MF 导出共用。调整预览不得暗中改变可打印几何或配合尺寸。
- 柜边、框套间隙、抽拉配合与打印盘额外边距是独立参数。额外打印边距默认 0。
- 超过打印机实际最大 XYZ 才阻止导出；可换方向或占用建议留边是 warning，不阻止导出。
- Three.js 渲染使用均匀底色与轮廓线，不加场景灯光和投影阴影；立体视图透视投影，正面及俯视正交投影。
- 触摸板双指滑动绕模型旋转相机，捏合缩放。不要将双指滑动改成平移或缩放。
- 本地草稿保存在 `boxfinity.cabinet.v2`。验证 UI 时保留用户布局；需要空白设计时使用独立测试端口/来源，不清空用户当前方案。
- UI 避免多余的次要标签和说明，用布局解释操作。保持现有中性色与少量状态色，不默认引入薄荷绿主题。

## 验证

- 几何、排盘、3MF 或相机/手势逻辑变更运行相关测试；交付前运行 `npm test` 和 `npm run build`。
- UI 变更实际运行并检查关键状态。依赖现有浏览器工具，不擅自安装 Playwright 等新工具。
- 不为可逆的低影响改动或实现细节镜像编写测试。新增测试应验证用户行为或几何/坐标等关键不变量。
- 当前无导轨、限位、框套连接件或承重验证；不要把预览布局描述为已经验证的自承重格架。
