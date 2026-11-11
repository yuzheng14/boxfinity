# Boxfinity

本地运行的柜内抽拉收纳设计原型：根据柜内宽、高推荐单元尺寸，在柜子正面网格上画出不同尺寸的盒子，预览开放框套与盒子的组合，再导出 3MF。

纯静态 React + TypeScript 网站。UI 使用已批准的 `react@^19.3.1`、`react-dom@^19.3.1`；3D 使用 `three@^0.187.0`（含同包 OrbitControls）；构建使用 `vite@^8.3.7` 和 `@vitejs/plugin-react@^6.3.0`。Three.js 随 Vite 产物本地加载，无 CDN、后端或数据上传。项目采用 [MIT 协议](./LICENSE)，源码位于 [yuzheng14/boxfinity](https://github.com/yuzheng14/boxfinity)。在线使用：[Boxfinity](https://yuzheng14.github.io/boxfinity/)。

## 运行

支持 Node.js 22.12+（22.x）、24.x 或 26+，与 Vitest 的版本要求一致；CI 使用 Node.js 22。首次运行先安装锁文件中的依赖：

```sh
npm ci
npm run dev
```

应用源码和单元测试使用 TypeScript。`tsconfig.json` 检查浏览器源码，`tsconfig.test.json` 检查测试、夹具与 Vitest 配置，均启用严格检查。`npm run typecheck` 执行两者；`npm run build` 先检查类型再打包，CI 使用相同命令。

打开终端输出的地址（默认 <http://localhost:5173/boxfinity/>，端口占用时自动顺延）。Vite 开发服务提供模块解析与热更新。构建部署版本运行 `npm run build`，再用任意静态 HTTP 服务托管 `dist/`；`npm run preview` 可本地检查构建结果。Vite 的 base 为 `/boxfinity/`，与 GitHub Pages 仓库子路径一致。ES 模块需要 HTTP，不要通过 `file://` 打开。

```sh
npm test                 # Vitest 单次运行，适用于 CI
npm run test:watch       # 本地监听变更
npm run typecheck        # 源码与测试的严格类型检查
```

单测使用已批准的 `vitest@^5.1.0`，测试文件为 `tests/*.test.ts`。保留现有几何、排盘、3MF、编辑状态及相机断言；使用 Node 环境运行，无需 DOM 或 GPU。相机测试调用真实 Three.js 相机和 OrbitControls，渲染器的 DOM/WebGL 集成由浏览器测试负责。运行测试不会替代类型检查。Node 测试 API 的类型由已批准的 `@types/node@^22.20.5` 提供。

## 浏览器测试

E2E 使用已批准的 `@playwright/test@^1.65.0`，首批运行 Chromium。首次安装或更新 Playwright 后，安装它配套的浏览器：

```sh
npx --no-install playwright install chromium
npm run test:e2e
```

`test:e2e` 先执行严格类型检查和生产构建，再自动启动 `/boxfinity/` 子路径的独立预览服务，结束后关闭服务。默认端口为 4318；并行 worktree 可用 `BOXFINITY_E2E_PORT=4319 npm run test:e2e`。端口被占用会失败，不复用其他会话的服务。每个用例使用隔离的浏览器上下文，不读取或清空用户浏览器的草稿。

覆盖真实 WebGL 输出、拖选与撤销/重做、预设与自定义参数、无效输入保留有效方案、JSON 下载/导入和刷新恢复、滚轮旋转与 Ctrl+滚轮缩放、warning 允许导出和真正超限阻止导出。下载验证会检查 ZIP/3MF 容器、CRC、模型内容、零件清单和打印方向，不仅检查按钮是否可点。单测继续验证精确几何和相机不变量；E2E 不代替触摸板硬件的手动体验检查。

本地交互调试用 `npm run test:e2e:ui`。HTML 报告位于 `playwright-report/`，可通过 `npx --no-install playwright show-report` 查看；失败保留截图和 trace。CI 安装 Chromium 及 Linux 系统依赖，在 PR 和 main 中运行相同测试，并保存报告 7 天。报告和 `test-results/` 不提交到源码。

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
6. 点击「下载整套 3MF」一次导出全部打印盘，在 Bambu Studio / OrcaSlicer 中作为项目打开。仍可逐盘下载，或下载含整套 3MF、各盘 3MF、`assembly.json` 和打印说明的 ZIP；选中一组也使用同样的导出方式。

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

整套 `3MF` 使用 Bambu Studio / OrcaSlicer 的 `Metadata/model_settings.config` 记录盘归属，项目坐标使用切片器的方形盘网格（20% 盘间距），每盘内部坐标与预览一致。打印范围写入 `Metadata/project_settings.config`，装配清单内嵌在 `Metadata/assembly.json`。多盘归属属于切片器项目格式，并非 3MF Core 的通用能力；其他切片软件请使用单盘 3MF。项目配置沿用「最大打印范围」中选择的拓竹机型，引用切片软件内置的 **0.4 mm 喷嘴、Generic PETG 与 0.20 mm Standard 工艺**，由系统预设继承机器和耗材脚本，不打包 G-code。自定义尺寸、旧方案或没有 Bambu 官方映射的其他品牌机型以 **Bambu Lab X1 Carbon 0.4 nozzle** 兼容兜底；弹窗会注明兜底，导入后必须切换实际机型。所有情况都保留输入的 XYZ、几何、朝向与盘内位置，不能把兜底机型视为自定义范围的硬件验证。切片前核对喷嘴、耗材与双喷嘴等打印模式；较旧切片软件缺少所选机型时仍可能提示预设不存在。多盘项目最多 36 盘；超过时可下载包含全部单盘文件的 ZIP。`assembly.json` 记录行列、跨格、柜内位置与各盘零件编号。

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

[CI and Pages](./.github/workflows/ci-pages.yml) 在 PR 和 main 提交时使用 Node.js 22 安装锁定依赖、检查格式和 lint、运行 Vitest、严格检查源码与测试类型、构建并运行 Chromium E2E。PR 任务只有源码读取权限；main 构建成功后上传 `dist/`，由独立部署任务发布到 [GitHub Pages](https://yuzheng14.github.io/boxfinity/)。也可在 Actions 页面手动运行 main 的工作流。部署任务使用 `github-pages` 环境，仅它拥有 Pages 和 OIDC 写权限。

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
