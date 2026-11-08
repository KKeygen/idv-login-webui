# Starward 设计系统对齐说明

本轮改造以用户提供的 Starward 0.18.0 源码为设计规范来源，主要参考：

- `src/Starward/App.xaml`
- `src/Starward/Features/GameInstall/InstallGameDialog.xaml`
- `src/Starward/Features/GameLauncher/GameLauncherSettingDialog.xaml`
- `src/Starward/Features/GameLauncher/StartGameButton.xaml`

项目保留自身品牌、信息架构和业务内容，没有复制 Starward 的图片、图标资产或品牌元素；对齐的是控件尺寸、层级关系、空间节奏、交互状态和弹窗结构。

## 设计思想

1. **一个区域只有一个主表面。** 窗口、侧栏和对话框可以使用 Acrylic/半透明表面，内部按钮、列表和设置项保持扁平，避免“每一层都是玻璃卡片”。
2. **稳定的控件几何。** 悬停只改变填充、描边和透明度，不改变宽高，不推动相邻元素，也不使用弹跳或放大动画。
3. **内容优先。** 设置页面用 NavigationView 式侧栏加平面内容区；对话框内部不再堆叠装饰性卡片。
4. **克制的圆角。** 8px 是绝大多数控件和表面的默认圆角；4px 用于导航选中项；22px 只用于 44px 高的主启动按钮胶囊。
5. **短而线性的反馈。** 状态反馈以 83ms、167ms、250ms 三档为主，普通 hover 不再使用长距离位移或缩放。

## 尺寸规范

| 元素 | 规范 |
| --- | --- |
| 图标按钮 / 关闭按钮 | 32 × 32px，8px 圆角 |
| 常规按钮、输入框、下拉框 | 36px 高，8px 圆角 |
| 导航项、路径行 | 40px 高，4px / 8px 圆角 |
| 主启动按钮 | 44px 高，最小宽 180px，22px 圆角 |
| 游戏安装弹窗 | 560px 宽，8px 圆角，24px 内容边距 |
| 游戏设置弹窗 | 800 × 480px，8px 圆角，200px 导航栏 |
| 主间距阶梯 | 8 / 12 / 16 / 24px |

## 字体规范

- UI 字体：`Segoe UI Variable`, `Segoe UI`, 系统无衬线字体。
- 辅助文字：12px。
- 正文与控件：14px。
- 分组标题：16px，600 字重。
- 对话框标题：18px，600 字重。
- 导航窗格标题：20px，400 字重。
- 页面标题：24–28px，600 字重。

## 表面与状态

- 深色基础表面：接近 `#2C2C2C`。
- 强调色：`#CBAD8E`，来自 Starward 默认主题色。
- 默认控件填充：低透明白色；hover 稍亮；pressed 稍暗。
- 危险操作只使用红色文字/图标和克制的状态填充，不使用高饱和大面积红底。
- 焦点态使用清晰的 2px 外轮廓，保证键盘导航可见。

## 页面映射

- `LauncherView.vue`：主启动按钮改为 Starward `StartGameButton` 式 44px 胶囊；游戏切换项改为固定尺寸，不再 hover 展开。
- `InstallGameModal.vue`：按 `InstallGameDialog.xaml` 重构，先在 560px 对话框中确认路径、解压空间和可用空间，再开始安装。
- `GameSettingsModal.vue`：按 `GameLauncherSettingDialog.xaml` 重构为 800 × 480px、200px NavigationView、40px 路径行和 36px 操作按钮。
- `SettingsView.vue`：改为平面 NavigationView 结构，取消大圆角玻璃侧栏和嵌套卡片。
- `AccountsView.vue`：采用 8px 列表容器、36px 操作按钮、32px 图标按钮和稳定行高。
- `CloudSyncView.vue`：主配置区保留单一 8px 表面，右侧命令压缩为 48px 高，移除旧版 64px 大卡片按钮。
- `ModalShell.vue`：统一 8px Acrylic 对话框、32px 关闭按钮、Escape 关闭和 167ms 淡入淡出。

## 实现入口

设计 token 和最终覆盖层集中在 `src/style.css` 的 `Starward / WinUI design language` 与 `Starward alignment pass` 两节。安装和游戏设置弹窗分别位于：

- `src/components/InstallGameModal.vue`
- `src/components/GameSettingsModal.vue`

单文件发行版可通过：

```bash
npm run build:standalone
```

生成 `dist/index.html`。
