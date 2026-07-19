# 功能覆盖清单

本清单用于约束 Vue 迁移与旧 `assets/index.html` 的行为覆盖。所有调用继续使用 `/_idv-login` 前缀。

## 游戏与启动器

- [x] 已记录游戏与动态游戏目录：`list-games`
- [x] 当前游戏切换，兼容完整/短 `game_id`
- [x] 无本地记录时直接进入通用下载/启动器界面，不保留日期化或固定游戏 onboarding
- [x] 分发和安装记录：`launcher-status`
- [x] 下载、更新信息、更新及异步任务：`launcher-install`、`launcher-update-info`、`launcher-update`、`import-status`
- [x] 默认/删除安装记录：`launcher-set-default`、`launcher-remove-installation`
- [x] Fever 单项和列表导入：`launcher-import-fever`、`fever-games`
- [x] 保留第五人格新旧引擎 Fever 长短 ID 跳转语义
- [x] 启动游戏：`start-game`
- [x] 新闻面板和持久化隐藏设置，不提供游戏时间统计

## 账号管理

- [x] 账号列表，保留 `netease*` 内部记录过滤：`list`
- [x] 登录切换与异步状态：`switch`、`switch-status`
- [x] 重命名、单个/批量删除：`rename`、`del`
- [x] 自动登录账号设置/清除：`setDefault`、`clearDefault`、`defaultChannel`
- [x] 手动渠道配置兼容 `channel` 和 `app_channel`：`manualChannels`
- [x] 手动导入与异步状态：`import`、`import-status`
- [x] 应用宝/Bilibili QR 状态轮询：`qrcode`
- [x] Bilibili 取消 QR 后网页登录：`cancel-qr`、`import?login_method=web`
- [x] 登录延迟：`get-login-delay`、`set-login-delay`

## 启动和工具设置

- [x] 自动启动和独立路径能力：`get-game-auto-start`、`set-game-auto-start`
- [x] 自动关闭：`get-auto-close-state`、`switch-auto-close-state`
- [x] 扫码记录和原生保存：`scan-record-setting`、`native-save-setting`
- [x] 代理模式：`proxy-mode`、`set-proxy-mode`
- [x] 导出诊断日志：`export-logs`
- [x] 创建桌面快捷方式：`create-game-shortcut`
- [x] 后端连接状态与刷新

## 云同步

- [x] 存储/权限说明：`cloud-sync/policy`
- [x] 设置读取和保存：`cloud-sync/settings`
- [x] 账号范围：`cloud-sync/accounts`
- [x] 生成、复制、文本导入/导出主密钥：`cloud-sync/generate-master-key`
- [x] 已有云记录探测：`cloud-sync/probe`
- [x] 上传、下载、方向同步：`cloud-sync/run`
- [x] 删除远端同步：`cloud-sync/delete`
- [x] 访问日志：`cloud-sync/access-logs`
- [x] 四步新建/导入配置向导

## 环境与兼容

- [x] `idvlogin://cdn/` 图片资源改写
- [x] `idvlogin://open/` 外链打开
- [x] 同步响应和 `{status: pending, task_id}` 异步响应
- [x] 缺失字段不直接解引用
- [x] 可选新接口 404 后保持 UI 可用并显示更新提示
- [x] 生产产物为单个自包含 HTML
