# 6.3.2 游戏内账号切换向导

## 入口与兼容

- 只有 `/health.version >= 6.3.2` 时，才显示向导、账号管理齿轮和应用设置入口，或调用 `/account-list-config`。
- 未知版本、旧后端和旧网页/API 的原有功能不变；不使用额外的 model-version 标记。
- `?view=account-switching` 是一次性向导入口。健康检查通过且满足版本要求后打开；随后消费 URL 参数，刷新不会再次打开。普通页面启动不主动打断用户。
- `/account-list-config` 返回 404 时隐藏新增功能并保留原有界面。网络/服务失败时保留重试入口。

## 配置契约

GET `/_idv-login/account-list-config`：

- `{ success, config, games }`
- `config` 包含 `enabled`、`onboarding_completed`、`auto_import_new`、`limit_enabled`、`recent_limit` 和 `games`
- `config.games[local_game_id] = { enabled, account_uuids }`
- 每个游戏安装包含 `game_id`、`short_game_id`、`local_game_id`、`installation_id`、`installation_label`、`name`、`tool_account_count`、`native_account_count`、`accounts`
- `local_game_id` 是不透明的安装级键，由短游戏 ID 和安装 UUID 组成；前端不得用 mpay ID 合并安装
- `accounts` 只需要 `uuid`、`name`/`display_name`、`last_login_time`，不包含登录凭据

POST 相同 URL，body 为 `{ config }`。可返回 `{ success, config }`；前端只发送白名单配置字段。

默认总开关关闭。向导只是准备草稿；完成前不保存账号选择或开启功能。“不感兴趣”只发送 `{ config: { onboarding_completed: true } }`，不重发或重置账号选择；后端应跳过此类请求的数据库刷新。拒绝后立即关闭并显示非模态提示，元数据确认在后台进行；失败或长时间未返回不会阻塞关闭、重新打开或保存配置。已配置用户重新打开并取消，不会关闭其功能。

向导按“功能介绍 → 选择游戏 → 账号与偏好 → 更多说明”进行，账号勾选与两个偏好选项位于同一页。游戏安装和账号使用紧凑表格，账号表按本地安装分组；介绍页使用打码红色矢量标识和扫码页点击游戏图标的示意。只有新一次打开会回到第一步，后台重载或保存不重置步骤或草稿。

新选游戏默认按 `last_login_time` 勾选最近 5 个账号。新账号自动导入、只显示最近 X 个两个选项默认勾选，X 默认 5。X 仅约束工具导入账号，游戏原生账号不计入、不因该限制被隐藏或删除。X>5 显示启动可能变慢的温和提醒。

账号管理的齿轮默认收起，展开后可以更改账号选择、两个选项和 X、查看说明或重新选择游戏。草稿与后台状态分离；关闭或导航离开不提交草稿。

## 本地验证

```bash
npm ci
npm run check:sfc
npm run check:logic
npm test -- --maxWorkers=1 --no-file-parallelism
npm run build
npm run build:standalone
node scripts/preview-account-switching.mjs
```

合成数据预览地址：`http://localhost:8788/?view=account-switching`。账号名称均为测试数据。可组合以下查询参数：

- `backend=6.3.1`：旧版门禁
- `empty=1`：未安装游戏
- `missing=1`：新接口 404
- `fail=load` / `fail=save`：加载/保存失败
- `slow=1`：延迟保存，检查重复点击与退出保护

`/__test/requests` 返回请求记录；`/__test/reset` 重置合成配置与记录，仅用于此预览服务。

浏览器验收需覆盖：桌面及窄屏实际页面；首次拒绝和设置重开；两份同游戏安装独立选择；最近五个默认值；手动取消选择后返回；X=6 温和提醒；无游戏/无账号；完成后默认收起齿轮；旧版本不出现入口且新 API 零调用；加载/保存失败重试；保存期间重复点击与 Escape；取消/刷新不重复打开。

## 与既有 staging 账号列表功能整合

保留 20f691a 的 `display_name`（包括后端生成的过期标记）和 `included` / `will_include` 显示，状态展示按工具版本及实际元数据类型判断。按新需求移除旧全局/单游戏额度、置顶入口、`/account-list-settings` 调用与额外 model-version 门禁，统一使用 6.3.2 版本门禁和上述显式配置契约。
