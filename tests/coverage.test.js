import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function collect(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? collect(join(dir, item.name)) : item.name.endsWith('.vue') || item.name.endsWith('.js') ? [readFileSync(join(dir, item.name), 'utf8')] : [])
}

describe('legacy API surface', () => {
  it('keeps every interactive endpoint represented', () => {
    const source = collect(new URL('../src', import.meta.url).pathname).join('\n')
    const endpoints = ['health','manualChannels','list','qrcode','cancel-qr','switch','switch-status','del','rename','import','import-status','setDefault','clearDefault','get-auto-close-state','switch-auto-close-state','get-game-auto-start','set-game-auto-start','start-game','list-games','launcher-status','launcher-locate','launcher-install','launcher-update','launcher-import-fever','launcher-remove-installation','fever-games','defaultChannel','get-login-delay','set-login-delay','cloud-sync/policy','cloud-sync/generate-master-key','cloud-sync/settings','cloud-sync/accounts','cloud-sync/probe','cloud-sync/run','cloud-sync/delete','cloud-sync/access-logs','export-logs','proxy-mode','set-proxy-mode','create-game-shortcut','scan-record-setting','native-save-setting','native/capabilities','native/window-drag','native/window-toggle-maximize','native/pick-directory','native/pick-executable','native/path-status','native/task-status','native/download-control','fever-bridge']
    for (const endpoint of endpoints) expect(source, endpoint).toContain(`/${endpoint}`)
  })

  it('distinguishes a failed backend connection from the initial connecting state', () => {
    const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
    expect(app).toContain("app.state.connection === 'disconnected' ? '工具未连接'")
  })

  it('does not use blocking browser alert, confirm, or prompt dialogs', () => {
    const source = collect(new URL('../src', import.meta.url).pathname).join('\n')
    expect(source).not.toMatch(/\b(?:alert|confirm|prompt)\s*\(/)
  })

  it('loads remote launcher artwork through image elements instead of CSS URLs', () => {
    const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
    const launcher = readFileSync(new URL('../src/components/LauncherView.vue', import.meta.url), 'utf8')
    const styles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
    expect(launcher).toMatch(/<img\b(?=[^>]*\bclass="launcher-hero-image")(?=[^>]*:src="hero")[^>]*>/)
    expect(app).toContain('class="workspace-tab-background" :src="activeGameBackground"')
    expect(launcher).not.toContain('`url(${hero})`')
    expect(styles).not.toMatch(/url\(\s*['"]?https?:\/\//i)
  })

  it('keeps game settings scoped internally while using game language in the UI', () => {
    const settings = readFileSync(new URL('../src/components/GameSettingsModal.vue', import.meta.url), 'utf8')
    const launcher = readFileSync(new URL('../src/components/LauncherView.vue', import.meta.url), 'utf8')
    const appSettings = readFileSync(new URL('../src/components/SettingsView.vue', import.meta.url), 'utf8')
    expect(settings).toContain('distribution_id: scope.distributionId')
    expect(settings).toContain('installation_id: scope.installationId')
    expect(settings).toContain('游戏设置')
    expect(settings).not.toMatch(/>[^<]*分发[^<]*</)
    expect(appSettings).not.toContain('/get-login-delay')
    expect(launcher).toContain('installed && needsUpdate')
    expect(launcher).toContain('更新游戏')
  })

  it('matches the Starward selector and shared start-button structure', () => {
    const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
    const rail = readFileSync(new URL('../src/components/GameRail.vue', import.meta.url), 'utf8')
    const styles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
    expect(app).toContain(':open="gameRailOpen || gameCatalogOpen"')
    expect(rail).toContain('app.state.railTabs.map')
    expect(rail).toContain(':class="{ active: item.active }"')
    expect(styles).toContain('.game-rail.open { transform: translateY(0); }')
    expect(app).toContain('class="top-game-strip"')
    expect(app).toContain('@pointerdown="prepareWindowDrag"')
    expect(app).toContain('@pointermove="continueWindowDrag"')
    expect(app).toContain('@dblclick="toggleWindowMaximize"')
    expect(rail).toContain('@pointerdown="prepareWindowDrag"')
    expect(rail).toContain('@pointermove="continueWindowDrag"')
    expect(rail).toContain("emit('catalog-change', true)")
    expect(styles).toContain('.game-tab-tooltip {')
    expect(styles).toContain('.launcher-view {\n  height: 100%;')
    expect(styles).toContain('.workspace {\n  position: relative;\n  isolation: isolate;')
    expect(styles).toContain('background: transparent !important;')
    expect(styles).toContain('position: absolute;\n  top: 0;\n  right: 0;\n  width: 44px;')
  })

  it('keeps the launcher and account page visually flat and predictable', () => {
    const launcher = readFileSync(new URL('../src/components/LauncherView.vue', import.meta.url), 'utf8')
    const accounts = readFileSync(new URL('../src/components/AccountsView.vue', import.meta.url), 'utf8')
    expect(launcher).toContain('launcher.value.button_color || stops[0]')
    expect(launcher).not.toContain('`linear-gradient(135deg, ${stops.join')
    expect(launcher).not.toContain('显示新闻')
    expect(launcher).not.toContain('class="installation-path"')
    expect(accounts).toContain('class="account-list-row"')
    expect(accounts).toContain("selected.has(account.uuid)")
    expect(accounts).not.toContain('class="account-card"')
  })

  it('keeps navigation animated while loading game-specific data on demand', () => {
    const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
    const store = readFileSync(new URL('../src/composables/useAppStore.js', import.meta.url), 'utf8')
    const rail = readFileSync(new URL('../src/components/GameRail.vue', import.meta.url), 'utf8')
    const accounts = readFileSync(new URL('../src/components/AccountsView.vue', import.meta.url), 'utf8')
    const settings = readFileSync(new URL('../src/components/SettingsView.vue', import.meta.url), 'utf8')
    const styles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
    expect(app).toContain('<KeepAlive>')
    expect(app).toContain('name="page-change" mode="out-in"')
    expect(store).toContain('async function ensureViewData')
    expect(store).toContain('const accountDataByGame = new Map()')
    expect(store).toContain('if (!cmpGameId(state.gameId, gameId)) return data')
    expect(app).toContain('app.loadInstalledRail().catch(() => {})')
    expect(app.match(/function showGameRail\(\)[\s\S]*?\n}/)?.[0]).not.toContain('loadInstalledRail')
    expect(store).toContain('if (!force && cached) return Promise.resolve(cached)')
    expect(store).not.toContain('launcherLoadedAt')
    expect(rail).toContain('loading="lazy" decoding="async"')
    expect(accounts).toContain('<span>登录账号</span>')
    expect(settings).toContain('同步保存到游戏原生记录 <HelpTip')
    expect(styles).toContain('.account-login-capsule .primary')
    expect(styles).toContain('white-space: nowrap;')
    expect(styles).toContain('@keyframes hero-image-in')
    expect(styles).toContain('.launcher-view { animation: none; }')
  })

  it('keeps toolbar activation scoped and presents user-facing state in Chinese', () => {
    const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
    const launcher = readFileSync(new URL('../src/components/LauncherView.vue', import.meta.url), 'utf8')
    const cloud = readFileSync(new URL('../src/components/CloudSyncView.vue', import.meta.url), 'utf8')
    const styles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
    expect(app).toContain('class="sidebar-current-game"')
    expect(app).toContain('@mouseenter="showGameRail"')
    expect(app).toContain('class="top-game-strip"')
    expect(app).toContain('@pointerenter="keepGameRailAlive"')
    expect(launcher).toContain("download_started: '下载核心已启动…'")
    expect(launcher).not.toContain('launcher.developer')
    expect(launcher).not.toContain('launcher.publisher')
    expect(launcher).not.toContain('startupTip')
    expect(cloud).toContain("bidirectional: '双向同步'")
    expect(cloud).not.toContain('{{ form.sync_direction }}')
    expect(styles).toMatch(/\.account-actions\s*\{[^}]*padding-top:\s*0;[^}]*border-top:\s*0;/s)
  })

  it('uses the inline download capsule for install, update, pause, and resume', () => {
    const launcher = readFileSync(new URL('../src/components/LauncherView.vue', import.meta.url), 'utf8')
    const styles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
    expect(launcher).toContain("request('/native/download-control'")
    expect(launcher).toContain("action = downloadPaused.value ? 'resume' : 'pause'")
    expect(launcher).toContain('class="download-flyout"')
    expect(launcher).toContain("import InstallGameModal from './InstallGameModal.vue'")
    expect(launcher).toContain(':open="installModalOpen"')
    expect(launcher).toContain('requiredInstallBytes')
    expect(launcher).not.toContain('class="modal install-modal"')
    expect(launcher).not.toContain("title: needsUpdate.value ? '更新游戏'")
    expect(styles).toContain('width: calc(100% - 44px);')
    expect(styles).toContain('backdrop-filter: none !important;')
  })

  it('keeps blur layers and image work bounded during navigation', () => {
    const api = readFileSync(new URL('../src/api.js', import.meta.url), 'utf8')
    const cache = readFileSync(new URL('../src/launcherCache.js', import.meta.url), 'utf8')
    const launcher = readFileSync(new URL('../src/components/LauncherView.vue', import.meta.url), 'utf8')
    const rail = readFileSync(new URL('../src/components/GameRail.vue', import.meta.url), 'utf8')
    const store = readFileSync(new URL('../src/composables/useAppStore.js', import.meta.url), 'utf8')
    const styles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
    expect(api).toContain('const resourceUrlCache = new Map()')
    expect(cache).toContain('const retainedImages = new Map()')
    expect(store).toContain('preloadLauncherImages(data)')
    expect(launcher).toContain('watch(downloadActive, syncClock')
    expect(launcher).toContain("document.visibilityState !== 'hidden' ? 750 : 1800")
    expect(rail).toContain('const catalogItems = computed')
    expect(rail).not.toContain(':src="railIcon(item)"')
    expect(styles).toContain(`button,
.sidebar-current-game`)
    expect(styles).toContain('backdrop-filter: none;')
    expect(styles).not.toContain('@keyframes game-scene-in')
  })

  it('deploys Fever UI only to the separate cloud field', () => {
    const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
    expect(workflow).toContain("github.ref == 'refs/heads/fever'")
    expect(workflow).toContain("cloud['login_base64_page_fever']")
    expect(workflow).toContain('git push origin HEAD:main')
    expect(workflow).not.toContain('cp dist/index.html target/assets/index.html')
  })
})
