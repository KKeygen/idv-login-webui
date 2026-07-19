# idv-login-webui

IdentityV Login Helper 的 Vue 3 单页前端。它把原先单个 `index.html` 中的界面、状态和 API 调用拆分成可维护的组件，同时保持后端 `/_idv-login/*` 契约不变。

## 设计目标

- 游戏启动器和账号管理是最高频入口。
- 顶栏的每个游戏图标代表当前游戏的一个分发，切换后安装、更新和本地安装记录同步切换。
- 新闻面板可以显示，也可在设置中隐藏；不统计游戏时间。
- 源码按组件维护，生产构建仍输出一个包含 Vue runtime、业务 JavaScript 和 CSS 的自包含 `dist/index.html`。
- 支持普通 HTTP(S) 页面及 `idvlogin://` Qt WebEngine 环境。外部图片通过 `idvlogin://cdn/`，外链通过 `idvlogin://open/` 交给宿主处理。
- 新字段在读取前进行能力判断。新接口返回 404 时保持页面可用，并在右上角提示需要更新工具。

## 开发与构建

```bash
npm install
npm run dev
npm test
npm run build
```

构建完成后只需部署 `dist/index.html`。它不依赖外部 JavaScript、CSS 或字体文件。

## 组件结构

```text
src/
├── api.js                       # API、异步任务轮询、scheme URL 适配
├── composables/useAppStore.js   # 游戏、账号、启动器与能力状态
├── components/
│   ├── GameRail.vue             # 游戏选择与分发顶栏
│   ├── LauncherView.vue         # 安装、更新、启动、Fever 导入、新闻
│   ├── AccountsView.vue         # 账号 CRUD、默认账号、QR/网页登录
│   ├── SettingsView.vue         # 自动启动/关闭、记录、代理、日志、快捷方式
│   ├── CloudSyncView.vue        # 云同步全集和四步配置向导
│   └── ModalShell.vue
└── App.vue
```

完整迁移范围与 API 对照见 [docs/feature-coverage.md](docs/feature-coverage.md)。

## 许可证

GNU General Public License v3.0 only，详见 [LICENSE](LICENSE)。
