# Boxfinity

本地运行的柜内抽拉收纳设计原型：根据柜内宽、高推荐单元尺寸，在柜子正面网格上画出不同尺寸的盒子，预览开放框套与盒子的组合，再导出 3MF。

纯静态 React + TypeScript 网站。UI 使用已批准的 `react@^19.3.1`、`react-dom@^19.3.1`；3D 使用 `three@^0.187.0`（含同包 OrbitControls）；构建使用 `vite@^8.3.7` 和 `@vitejs/plugin-react@^6.3.0`。Three.js 随 Vite 产物本地加载，无 CDN、后端或数据上传。项目采用 [MIT 协议](./LICENSE)，源码位于 [yuzheng14/boxfinity](https://github.com/yuzheng14/boxfinity)。在线使用：[Boxfinity](https://yuzheng14.github.io/boxfinity/)。

## 运行

需要现有的 Node.js 22.12 或更新版本。首次运行先安装锁文件中的依赖：

```sh
npm ci
npm run dev
```

应用源码使用 TypeScript，`tsconfig.json` 启用严格检查。`npm run typecheck` 单独检查类型，`npm run build` 先检查类型再打包；CI 使用同一构建命令。测试仍使用 Node 自带 runner，通过 `--experimental-strip-types` 直接运行核心 TS 模块，兼容 Node 22.12 起的类型剥离功能。

打开终端输出的地址（默认 <http://localhost:5173/boxfinity/>，端口占用时自动顺延）。Vite 开发服务提供模块解析与热更新。构建部署版本运行 `npm run build`，再用任意静态 HTTP 服务托管 `dist/`；`npm run preview` 可本地检查构建结果。Vite 的 base 为 `/boxfinity/`，与 GitHub Pages 仓库子路径一致。ES 模块需要 HTTP，不要通过 `file://` 打开。

```sh
npm test
npm run typecheck
```

## 代码检查

```sh
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

Oxlint 检查源码、测试与 Vite 配置中的正确性、React/Hooks 和 TypeScript 问题；CI 在测试前执行 lint，warning 也会使任务失败。`lint:fix` 仅应用安全修复。类型检查仍由 `npm run typecheck` 和构建前的 TypeScript 检查负责。

Oxfmt 统一 TypeScript/TSX、CSS、HTML、配置和文档格式，源码沿用单引号，其余采用默认格式。`format` 写入文件，`format:check` 只检查；CI 在 lint 前检查格式。生成目录沿用 `.gitignore`，npm 锁文件保持 npm 生成的内容。

## 工作流程

1. 左侧填写柜内净宽、高、深和实际打印范围。
2. 直接填写行列数，或点击「细分 / 均衡 / 大格」预设填入；下方独立显示当前单元格的宽 × 高。单元以柜内**宽 × 高**计算，深度单独设置。
3. 在右侧网格中拖选矩形，生成 1×1、1×2、2×1、3×2 等组合的收纳盒。先选快捷尺寸再单击，也可以直接放置。
4. 点击已有盒子或左侧列表选择它；查看抽出状态、尺寸、框套。支持删除、撤销、重做、填满空格和示例布局。
5. 在正面、3D、打印盘之间切换。柜体 3D 和打印盘立体视图使用透视相机，正面及打印盘俯视使用正交相机；绘制通过相机射线与柜体正面相交定位，SVG 只承载文字与交互区域。打印盘默认斜俯视立体预览，显示真实模型、开口和壁厚；可拖动旋转、双指旋转、捏合缩放，也可切换俯视检查间距。预览与 3MF 使用相同的零件朝向及排盘坐标。黄色 warning 表示需换方向或占用建议边距，仍可导出。红色表示所有轴向方向都超出打印机最大范围，会阻止完整导出。
6. 导出完整 ZIP 或选中一组，得到各盘 3MF、`assembly.json` 和打印说明。

触摸板双指滑动绕模型旋转相机，捏合缩放；普通滚轮同样控制旋转，Ctrl + 滚轮缩放。鼠标在「旋转视角」工具或打印盘立体视图中拖动旋转。正面与俯视中双指滑动会进入对应的立体视图；捏合仍在原视图内缩放。选择盒子或调整窗口时保留旋转方向和缩放倍率，「重置视角」回到默认角度。

修改参数自动更新。更换单元行列会清空旧布局，可通过撤销恢复。方案自动保存在当前浏览器，也可保存和导入 JSON。新版方案版本为 2，不兼容最初的平面收纳原型。

## 网格与结构

- 网格从柜子**正面**观察：列从左往右，行从上往下；3×2 表示宽跨 3 列、高跨 2 行。
- 每个矩形区域生成一个四面开放框套，以及一只带 U 形前沿指扣的开口盒。
- 单元尺寸包含框套占用；实际盒子尺寸扣除框套壁厚和每侧抽拉间隙。
- 框套和盒子独立打印。优先保持框套开口朝上、盒子底面朝下。如果默认朝向放不下，检查六种轴向摆放；存在可用方向时侧放并提醒检查支撑。装配时让框套开口朝前。
- 每个框套的侧壁独立保留；相邻模块不是共享薄壁，因此可按不同矩形组合。
- 柜边、框套之间、抽拉配合分别有独立间隙。
- 推荐单元必须使 1×1 框套和盒子均可整件打印。更大的组合仍需各自检查，不能因基本单元可打印就假定任意合并都可打印。

## 文件与验证

3MF 使用 [3MF Core Specification](https://github.com/3MFConsortium/spec_core) 的 OPC、XML 和 ZIP 容器，单位为毫米；几何与预览复用同一网格。每盘排放变尺寸零件，检查六种轴向摆放，优先保留原接触面，保留 5 mm 零件间距；不保证盘数最优。

打印机最大 XYZ 是硬限制。额外打印边距默认 **0 mm**，直接使用输入的实际可打印范围；需要额外留边时再自行设置。柜边、框套之间及抽拉配合的装配间隙独立保留。手动设置的每侧 XY 边距是建议值。优先按 `(X−2×边距) × (Y−2×边距) × Z` 留边目标排盘；只有零件无法保留建议边距时，才在最大范围内使用较小留边，并显示实际边距 warning。常规零件不会为了减少打印盘而牺牲留边。所选零件显示装配尺寸、实际打印 XYZ、Z 轴换向和实际边距；用户参数与几何尺寸均不自动修改。

3MF 仅含几何与排盘，不含机型、材料配置或 G-code。导入切片软件后需选择实际打印机和耗材。`assembly.json` 记录行列、跨格、柜内位置与各盘零件编号。

相机测试覆盖近大远小、不同长宽比下的完整取景、正交视图比例、旋转后的网格射线拾取，以及 Three.js 预览顶点与 3MF 六种朝向的一致性。核心测试覆盖：宽高轴定义、推荐单元、混合尺寸、重叠检测、反向拖选、补齐空格、抽拉间隙、变尺寸排盘、闭合网格、三角形朝向、指扣、框套体积、六种打印方向、warning 与 error 分级、实际排盘留边、旋转变换和完整 3MF 导出。

## 原型范围

当前支持矩形组合，每只盒子和框套均需**整件**满足打印范围，尚无沿柜深或宽高分段拼接。深柜可能因此需要更大的打印机或后续的拼接结构。

框套需要在柜内可靠固定。当前没有框套连接件、导轨、抽出限位或防倾倒结构；留空、悬空布局只是编辑方案，不能直接视为自承重格架。配合间隙、变形和承重尚未经过实物验证，先试打一组。

## 代码结构

共享领域类型定义在 `src/types.ts`，相机与视图类型在 `src/view-types.ts`。入口 `index.html` 位于项目根目录，源码在 `src/`，无需处理的静态资源（如 favicon）在 `public/`。

- `src/core.ts`：参数、推荐单元、柜内组合尺寸、打印约束、变尺寸排盘。
- `src/layout.ts`：矩形拖选、占用、重叠检测与填充。
- `src/printing.ts`：有效打印范围、六种朝向、超限原因与一致的旋转变换。
- `src/geometry.ts`：带前沿指扣的盒子、开放框套的闭合网格。
- `src/export.ts` / `src/zip.ts`：3MF、打印 ZIP 与装配清单。
- `src/renderer.ts`：Three.js 场景、均匀底色与轮廓线、OrbitControls、柜体与打印盘预览；保留真实透视和遮挡，不使用灯光及投影阴影。
- `src/view-camera.ts`：透视/正交取景、标注投影和网格射线拾取。
- `src/view-input.ts`：区分双指滑动旋转与捏合缩放，统一处理像素、行与页单位。
- `src/view-geometry.ts`：将现有几何与打印方向转换为 Three.js BufferGeometry。
- `src/main.tsx` / `src/App.tsx`：React 入口与应用组合，连接导入、导出及全局快捷键。
- `src/editor.ts` / `src/use-editor.ts`：有效设计、输入草稿、撤销/重做、选择和 localStorage 持久化；无效输入保留最近的有效方案。
- `src/components/`：参数面板、测量浮层、盒子列表、三维视口、帮助与导出弹窗。
- `src/components/PreviewWorkspace.tsx`：Three.js 与 React 的边界，指针/滚轮交互及卸载清理。
- `index.html` / `src/style.css`：页面入口、左右两栏样式与响应式布局。
- `vite.config.mjs`：GitHub Pages 子路径、React 插件与第三方许可证输出，其余使用 Vite 默认配置。

## 自动检查与发布

[CI and Pages](./.github/workflows/ci-pages.yml) 在 PR 和 main 提交时使用 Node.js 22 安装锁定依赖、运行测试、严格类型检查并构建。PR 任务只有源码读取权限；main 构建成功后上传 `dist/`，由独立部署任务发布到 [GitHub Pages](https://yuzheng14.github.io/boxfinity/)。也可在 Actions 页面手动运行 main 的工作流。部署任务使用 `github-pages` 环境，仅它拥有 Pages 和 OIDC 写权限。

首次配置仓库时，将 Settings → Pages → Build and deployment → Source 设为 **GitHub Actions**。工作流中官方 Actions 已获批准并固定到完整提交 SHA；版本升级仍需先审批。不要将生成的 `dist/` 提交进源码分支。

## 多会话开发

每个会话使用独立功能分支和 worktree，避免同时修改同一份工作目录：

```sh
git fetch origin
git worktree add ../boxfinity-my-task -b feat/my-task origin/main
cd ../boxfinity-my-task
npm ci
npm run dev -- --port 5175
```

默认端口占用时 Vite 会选择下一个可用端口；需要固定会话端口时使用 `--port`。通过 PR 合入 main。详细模块边界、验证和截图要求见 [AGENTS.md](./AGENTS.md)。

## 许可证

项目使用 [MIT](./LICENSE)。Three.js、React、React DOM 和 Scheduler 的许可证由 Vite 内置功能写入 `dist/THIRD_PARTY_LICENSES.md`，随静态产物一起发布。
