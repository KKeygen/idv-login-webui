# idv-login-webui

IdentityV Login Helper 的 Vue 3 单页前端。它把原先单个 `index.html` 中的界面、状态和 API 调用拆分成可维护的组件，同时保持后端 `/_idv-login/*` 契约不变。

## 设计目标

- 游戏启动器和账号管理是最高频入口。
- 顶栏的每个游戏图标代表当前游戏的一个分发，切换后安装、更新和本地安装记录同步切换。
- 新闻面板可以显示，也可在设置中隐藏；不统计游戏时间。
- 源码按组件维护，生产构建仍输出一个包含 Vue runtime、业务 JavaScript 和 CSS 的自包含 `dist/index.html`。
- 支持普通 HTTP(S) 游戏页面、旧 `idvlogin://` 环境，以及无内嵌 WebView 宿主的虚拟 `https://idv-login.invalid` origin。
- 虚拟 origin 的 `/_idv-login/*` 请求由宿主预注入 fetch 桥处理，未部署网站或开放 localhost API。外链交给原生处理器；图片直接走 HTTPS。旧 scheme 环境仍保留 CDN/open 适配。
- 拖动/最大化等宿主能力按后端声明启用；独立浏览器使用浏览器原生标题栏，不模拟 frameless 窗口。
- 新字段在读取前进行能力判断。新接口返回 404 时保持页面可用，并在右上角提示需要更新工具。

## 开发与构建

```bash
npm install
npm run dev
npm run check:sfc
npm run check:logic
npm test
npm run build
# 或直接生成不依赖 Rollup 原生模块的单文件发行版
npm run build:standalone
```

构建完成后只需部署 `dist/index.html`。它不依赖外部 JavaScript、CSS 或字体文件。

本分支为 `fever` 配套前端。既有工作流在 push / PR 执行测试和单文件构建，
只有 `fever` 分支非 PR 的提交会把 `dist/index.html` 编码到 `KKeygen/idv-login`
的 `assets/cloudRes.json` 字段 `login_base64_page_fever`，并更新 `lastModified`。
跨仓库写入使用既有 Deploy Key。特性分支和 PR 不部署，不需要手工提交 `dist`。

无内嵌 WebView 后端与此变更配套：先合入前端并等待原有部署，再合后端。
API 字段、任务轮询、游戏 HTTP 环境及旧版宿主保持兼容；仅外链识别、视觉缓存
和标题栏能力使用新宿主声明。

## 组件结构

```text
src/
├── api.js                       # API、异步任务轮询、scheme URL 适配
├── motion.js                    # Starward/WinUI 局部 Reveal 与指针动效
├── modalStack.js                # 多层模态框的顶层关闭语义
├── installRequirements.js       # 安装磁盘空间统一计算
├── composables/useAppStore.js   # 游戏、账号、启动器与能力状态
├── components/
│   ├── MotionProgressRing.vue   # 确定/不确定 ProgressRing
│   ├── GameRail.vue             # 游戏选择与分发顶栏
│   ├── LauncherView.vue         # 安装、更新、启动、Fever 导入、新闻
│   ├── InstallGameModal.vue     # Starward 风格游戏安装对话框
│   ├── GameSettingsModal.vue    # Starward 风格游戏设置对话框
│   ├── AccountsView.vue         # 账号 CRUD、默认账号、QR/网页登录
│   ├── SettingsView.vue         # 自动启动/关闭、记录、代理、日志、快捷方式
│   ├── CloudSyncView.vue        # 云同步全集和四步配置向导
│   └── ModalShell.vue
└── App.vue
```

完整迁移范围与 API 对照见 [docs/feature-coverage.md](docs/feature-coverage.md)。Starward 设计规范映射见 [STARWARD_DESIGN_SYSTEM.md](STARWARD_DESIGN_SYSTEM.md)，动效范式与实现说明见 [STARWARD_MOTION_SYSTEM.md](STARWARD_MOTION_SYSTEM.md)。逻辑审计结论、兼容性变化和后续维护约束见 [handoff.md](handoff.md)。

## 许可证

GNU General Public License v3.0 only，详见 [LICENSE](LICENSE)。
