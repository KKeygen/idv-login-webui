# 验证记录

## 已通过

- `node --check`：`src/` 与 `scripts/` 下全部 JavaScript / MJS 文件。
- `npm run check:sfc`：12 个 Vue 单文件组件均完成解析、脚本编译与模板编译。
- `npm run check:logic`：安装空间语义、零可用空间边界，以及异步作用域/KeepAlive 生命周期关键不变量均通过。
- `npm run build:standalone`：成功生成自包含 `dist/index.html`。
- 不可达代码清理后，使用 Node 直接验证模态框运行期层级、顶层判定，以及 confirm/prompt 队列的完成与取消语义。
- 已扫描并确认生产源码、测试和构建脚本中不再引用已删除的 `setModalOpen`、`modalStackDepth`、`showAlert`、`warmLauncherImages` 或 `setLauncher`。
- Chromium 完整 mock 回归：Launcher、账号管理、云同步、应用设置、游戏安装对话框和游戏设置对话框均可渲染，页面错误与控制台错误均为 0。
- Reveal 实测：按钮和账号行可接收局部指针坐标，激活态光斑实际可见；离开控件后立即清除。
- 页面切换实测：主页面恢复 `mode="out-in"`，确保任一时刻只有一个 KeepAlive 页面处于激活生命周期；新页面仍从 16px 内进入。
- 游戏栏实测：整体采用 167ms Y 轴 Vector-style transition；子项支持增删和重排过渡。
- ProgressRing 实测：不确定环同时具备旋转和弧长动画；确定环可平滑表达下载百分比。
- 安装对话框：560px 宽、8px 圆角；关闭按钮 32px；路径行与普通按钮 36px。
- 游戏设置对话框：800 × 480px、8px 圆角；导航宽 200px；导航项与路径行 40px；普通操作按钮 36px。
- 应用设置：导航宽 220px；导航项 40px 高、4px 圆角；内容卡片为平面结构，无嵌套毛玻璃或阴影。

本轮逻辑回归另使用 Chromium 内存 mock 后端验证：嵌套模态框需要两次 Escape 才逐层关闭；游戏 B 的安装请求保持 `game_id=game-b`、`distribution_id=2` 与所选路径；诊断页面快速离开/返回时只保留一个 generation，离开后轮询计数保持不变；QR 请求最大并发为 1，账号页停用后会调用 `/cancel-qr`；页面错误与控制台错误均为 0。静态逻辑检查还确认 AppDialogHost 不再使用 document 级 Enter 监听。

浏览器动效采样记录位于开发过程产物 `idv-motion-validation.json`；交付包内保留源码与文档，不包含测试截图和临时 mock 文件。

## 环境限制

上传项目附带的 `node_modules` 来自 macOS arm64，而当前验证环境为 Linux x64；Rollup 的 Linux 原生可选模块不存在，因此原有 `npm test` / Vite 构建无法在这份旧 `node_modules` 上启动。错误为缺少 `@rollup/rollup-linux-x64-gnu`，与本轮源码修改无关。

交付包不包含平台绑定的 `node_modules`。在目标开发机执行以下命令即可安装正确平台依赖并运行原有测试：

```bash
npm ci
npm run check:logic
npm test
npm run build
```

不依赖 Rollup 原生模块的单文件构建可直接使用：

```bash
npm run build:standalone
```
