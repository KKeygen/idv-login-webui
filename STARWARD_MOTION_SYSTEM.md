# Starward 动效系统对齐说明

本轮以用户提供的 Starward 0.18.0 源码为行为规范来源，重点参考：

- `src/Starward/Features/GameLauncher/StartGameButton.xaml`
- `src/Starward/Features/GameSelector/GameSelector.xaml`
- `src/Starward/Features/ViewHost/MainView.xaml`
- `src/Starward/Features/ViewHost/MainView.xaml.cs`
- `src/Starward/Features/ViewHost/MainWindow.xaml`
- `src/Starward/Features/GameInstall/InstallGameDialog.xaml`
- `src/Starward/Features/GameLauncher/GameLauncherSettingDialog.xaml`

对齐目标不是复刻某一帧截图，而是把 Starward/WinUI 的动效规则映射到 Vue 和 CSS：控件状态短促、导航有连接感、列表重排可追踪、等待状态明确，同时避免网页式悬停放大、弹簧动画和全屏追光。

## 1. 拂掠与指针反馈

Starward 的控件使用 WinUI 默认控件状态与 Reveal 语义。它的“拂掠”不是自动循环横扫的装饰光带，而是指针附近的小范围局部光照；光只存在于当前可交互控件的裁切范围内。

本项目通过 `src/motion.js` 实现事件委托式 Reveal：

- 只监听一组文档级 `pointermove` / `pointerout`，不为每个按钮注册监听器。
- 只更新当前指针下的控件。
- 坐标写入合并到每帧最多一次 `requestAnimationFrame`。
- 光斑由控件自身的 `::after` 绘制并被圆角裁切，不创建全屏渐变层。
- 触摸输入、禁用控件和 `prefers-reduced-motion` 环境不启用 Reveal。
- 可对非按钮控件添加 `data-reveal`；可用 `data-reveal="off"` 显式关闭。

光斑半径控制在约 92–96px，作用是让控件边界与层级在鼠标经过时轻微显现，不改变布局，也不会遮断点击。

## 2. 悬停与按压范式

`StartGameButton.xaml` 的 `CommonStates` 使用 `Normal / PointerOver / Pressed / Disabled`，背景刷过渡时长为 83ms。由此形成项目统一的控件状态规则：

- Hover：83ms 内改变背景、描边或透明度。
- Pressed：使用 pressed fill；不向上跳、不放大。
- Disabled：降低对比度并停止 Reveal。
- Focus：保留清晰焦点轮廓，不依赖 hover 才能理解状态。
- 图标动画只用于与语义相关的局部元素，例如设置齿轮；不会让整个按钮旋转或缩放。
- Tooltip 采用短暂驻留后显示、离开立即隐藏的节奏。

项目保留三档时序：

| Token | 时长 | 用途 |
| --- | ---: | --- |
| `--motion-fast` | 83ms | hover、pressed、描边和短透明度反馈 |
| `--motion-base` | 167ms | 控件切换、局部面板、列表增删 |
| `--motion-slow` | 250ms | 页面连接动画、背景交叉淡化、列表重排 |

主缓动为 `cubic-bezier(.1,.9,.2,1)`；纯透明度反馈可以使用 linear。

## 3. 页面与内容切换

### 主页面导航

主导航采用连接式动画：旧页面保持原位并淡出，新页面从右侧 16px 内进入。两页短暂重叠，避免 `out-in` 模式产生空白帧。

实现位置：

- `src/App.vue` 的 `page-change` Transition
- `src/style.css` 的 `.view-host` 与 `.page-change-*`

### 游戏与分发切换

Starward 在切换游戏时使用 `SuppressNavigationTransitionInfo`。项目采用同一思想：

- `LauncherView` 不因 `gameId` 变化整体重建。
- 页面结构、下载状态和交互上下文保持挂载。
- 只对实际变化的背景、Hero 图和品牌标题执行 250ms 交叉淡化。
- 不重播整个页面的入场位移。

这既更接近参考项目，也减少了图片解码、DOM 重建和状态闪烁。

### NavigationView 子页面与向导

应用设置、游戏设置和云同步向导采用更小的连接位移：进入 12px，离开 6px，持续 167–250ms。层级越浅，运动距离越小。

### 弹窗

ContentDialog 式弹窗使用：

- 背景遮罩单纯淡入淡出。
- 内容从下方 8px、98% 比例轻微就位。
- 关闭时仅下移 4px、缩至 99%。
- 不使用弹簧、回弹或全屏缩放。

## 4. 游戏选择器、列表与通知

`GameSelector.xaml` 使用 `Vector3Transition` 控制整个选择器的 Y 轴移动，并用 `RepositionThemeTransition` 处理子项重排。因此项目将：

- 游戏栏整体从 `translateY(-100px)` 过渡至 0。
- 游戏图标增删使用短透明度与轻微缩放。
- 图标排序、账号列表和游戏目录重排使用 move transition。
- 离场元素临时绝对定位，让其余元素平滑补位。

`MainWindow.xaml` 的通知容器使用 `AddDeleteThemeTransition`。项目中的 Toast 现在通过 `TransitionGroup` 对增添、删除和队列重排统一做 167–250ms 的淡入与 10px 位移。

## 5. 加载动画

Starward 对真实等待状态主要使用 `ProgressRing`，而不是无休止的骨架闪烁或文字省略号。本项目新增 `src/components/MotionProgressRing.vue`：

- 14–18px：行内磁盘读取和按钮命令。
- 20px：常规启动、更新、导入和保存操作。
- 28–32px：页面、游戏设置和对话框加载。
- 42px：二维码状态等待。
- 30px determinate ring：游戏下载进度，中心显示百分比。

不确定进度使用旋转与弧长变化；确定进度使用 `stroke-dasharray` 平滑更新。所有进度环都提供 `role="progressbar"` 和对应 ARIA 属性。

## 6. 性能与可访问性约束

- Reveal 的指针更新每帧最多一次，只影响当前控件，不产生文档级重绘光层。
- 页面切换主要动画 `opacity` 与 `transform`，避免过渡宽高、阴影和大面积 blur。
- 游戏切换不重建 Launcher 页面，只替换稳定缓存后的图片引用。
- 列表重排使用 transform，不逐帧修改几何尺寸。
- `prefers-reduced-motion: reduce` 下取消位移与旋转；不确定 ProgressRing 改为静态弧段，信息仍然可读。
- 动画不承担唯一的信息表达：busy、disabled、进度数字和状态文字仍然存在。

## 7. 实现入口

- 全局指针动效：`src/motion.js`
- 进度环：`src/components/MotionProgressRing.vue`
- 页面、背景、Toast：`src/App.vue`
- Hero、启动与下载状态：`src/components/LauncherView.vue`
- 游戏栏及目录：`src/components/GameRail.vue`
- 安装、游戏设置、账号、云同步和应用设置：各对应 Vue 组件
- 时序、Reveal、Transition 与 reduced-motion：`src/style.css` 的 `Starward motion-system alignment` 区段

单文件发行版通过以下命令生成：

```bash
npm run build:standalone
```
