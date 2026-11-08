<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Home, Users, Settings, Cloud, WifiOff, CircleHelp, FolderOpen } from '@lucide/vue'
import { openExternal, request, resourceUrl } from './api'
import { installMotionSystem } from './motion'
import { cmpGameId, gameTitle, useAppStore } from './composables/useAppStore'
import GameRail from './components/GameRail.vue'
import LauncherView from './components/LauncherView.vue'
import AccountsView from './components/AccountsView.vue'
import SettingsView from './components/SettingsView.vue'
import CloudSyncView from './components/CloudSyncView.vue'
import AppDialogHost from './components/AppDialogHost.vue'
import AccountSwitchingWizard from './components/AccountSwitchingWizard.vue'
import ImportGameWizard from './components/ImportGameWizard.vue'
import { useGameImport } from './composables/useGameImport'
import { useAccountSwitching } from './composables/useAccountSwitching'

const app = useAppStore()
const switching = useAccountSwitching()
const importing = useGameImport()
let deferredImportPrompt = false
let importWizardOpened = false
watch(() => importing.state.open, open => {
  if (open) { importWizardOpened = true; deferredImportPrompt = false }
}, { flush: 'sync' })
watch(() => switching.state.open, open => {
  if (open || !deferredImportPrompt) return
  deferredImportPrompt = false
  // Only the bootstrap prompt is deferred. Never reopen after a user visit or
  // cover a different dialog (the account wizard may be leaving right now).
  if (!importWizardOpened && !document.querySelector('.modal-backdrop:not(.dialog-fade-leave-active)')) importing.openWizard()
}, { flush: 'post' })
let switchingRouteHandled = false
watch(() => app.state.backendVersion, () => {
  if (!switching.supported.value) { switching.reset(); return }
  if (!switchingRouteHandled && new URLSearchParams(location.search).get('view') === 'account-switching') {
    switchingRouteHandled = true
    switching.openWizard()
    // Consume this one-shot route; dismissal and refresh return to normal UI.
    const url = new URL(location.href)
    url.searchParams.delete('view')
    history.replaceState({}, '', url)
  }
})
const gameRailOpen = ref(false)
const gameCatalogOpen = ref(false)
const viewComponents = { launcher: LauncherView, accounts: AccountsView, settings: SettingsView, cloud: CloudSyncView }
const activeViewComponent = computed(() => viewComponents[app.state.view])
const activeRailLauncher = computed(() => app.state.railLaunchers.find(item => cmpGameId(item.game_id, app.state.gameId)) || null)
const activeDistribution = computed(() => activeRailLauncher.value?.distributions?.find(
  item => String(item.distribution_id) === String(app.state.distributionId)
) || null)
const activeGameIcon = computed(() => resourceUrl(
  activeDistribution.value?.launcher?.icon
  || activeDistribution.value?.launcher?.logo
  || activeRailLauncher.value?.launcher?.icon
  || activeRailLauncher.value?.launcher?.logo
  || app.currentGame.value?.launcher?.icon
  || app.currentGame.value?.icon
  || ''
))
const activeGameBackground = computed(() => resourceUrl(
  activeDistribution.value?.launcher?.background_image
  || activeDistribution.value?.launcher?.main_image
  || activeRailLauncher.value?.launcher?.background_image
  || activeRailLauncher.value?.launcher?.main_image
  || app.state.launcherVisual?.background_image
  || app.state.launcherVisual?.main_image
  || app.currentGame.value?.launcher?.background_image
  || app.currentGame.value?.launcher?.main_image
  || ''
))
const activeGameTitle = computed(() => gameTitle({
  ...app.currentGame.value,
  launcher: activeDistribution.value?.launcher || activeRailLauncher.value?.launcher || app.currentGame.value?.launcher,
}, app.state.gameId))
const nav = [
  { id: 'launcher', label: '游戏启动器', icon: Home },
  { id: 'accounts', label: '账号管理', icon: Users },
  { id: 'cloud', label: '云同步', icon: Cloud },
]

let statusTimer
let motionCleanup = () => {}
let railCloseTimer
let dragCandidate = null
function showGameRail() {
  clearTimeout(railCloseTimer)
  gameRailOpen.value = true
}
function keepGameRailAlive() {
  if (!gameRailOpen.value && !gameCatalogOpen.value) return
  clearTimeout(railCloseTimer)
}
function scheduleGameRailClose(event) {
  clearTimeout(railCloseTimer)
  if (gameCatalogOpen.value) return
  if (
    event?.relatedTarget instanceof Element
    && event.relatedTarget.closest('.sidebar-current-game, .top-game-strip, .game-rail')
  ) return
  railCloseTimer = setTimeout(() => { gameRailOpen.value = false }, 140)
}
function isInteractiveTarget(target) {
  return target instanceof Element && Boolean(target.closest('button, a, input, select, textarea, [role="button"]'))
}
function prepareWindowDrag(event) {
  if (event.button !== 0 || isInteractiveTarget(event.target)) return
  dragCandidate = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
  event.currentTarget?.setPointerCapture?.(event.pointerId)
}
function continueWindowDrag(event) {
  if (!dragCandidate || dragCandidate.pointerId !== event.pointerId || !(event.buttons & 1)) return
  if (Math.hypot(event.clientX - dragCandidate.x, event.clientY - dragCandidate.y) < 3) return
  dragCandidate = null
  request('/native/window-drag', { method: 'POST' }).catch(() => {})
}
function cancelWindowDrag(event) {
  if (dragCandidate?.pointerId === event.pointerId) dragCandidate = null
  if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
}
function toggleWindowMaximize(event) {
  dragCandidate = null
  if (isInteractiveTarget(event.target)) return
  request('/native/window-toggle-maximize', { method: 'POST' }).catch(() => {})
}
function setGameCatalogOpen(open) {
  gameCatalogOpen.value = Boolean(open)
  if (gameCatalogOpen.value) showGameRail()
  else scheduleGameRailClose()
}
async function reconnect() {
  try {
    await Promise.all([app.loadGames(), app.loadNativeCapabilities()])
    await app.ensureViewData(app.state.view, { force: true })
    await importing.restore({ autoOpen: !switching.state.open })
  } catch { app.notify('重新连接或读取页面数据失败，请确认工具正在运行后重试', 'error') }
}
onMounted(async () => {
  motionCleanup = installMotionSystem(document)
  try {
    await Promise.all([app.loadGames(), app.loadNativeCapabilities()])
    await app.ensureViewData()
  } catch {
    if (app.state.connection === 'connected') app.notify('页面数据读取失败，请在应用设置的诊断页刷新全部数据；当前显示可能不完整', 'error')
  }
  importing.restore().then(() => {
    if (!importing.state.task || importWizardOpened) return
    if (switching.state.open) deferredImportPrompt = true
    else if (!document.querySelector('.modal-backdrop:not(.dialog-fade-leave-active)')) importing.openWizard()
  }).catch(() => {})
  // Populate every installed game once per launcher process. Hovering the
  // current-game icon must remain a presentation-only operation.
  app.loadInstalledRail().catch(() => {})
  statusTimer = setInterval(() => {
    if (document.visibilityState === 'visible') app.loadGames().catch(() => {})
  }, 10_000)
})
onBeforeUnmount(() => { clearInterval(statusTimer); clearTimeout(railCloseTimer); importing.dispose(); motionCleanup() })
</script>

<template>
  <main class="shell">
    <aside class="sidebar">
      <button class="sidebar-current-game" :title="activeGameTitle" :disabled="!app.state.gameId" @mouseenter="showGameRail" @mouseleave="scheduleGameRailClose" @click="app.setView('launcher')">
        <img v-if="activeGameIcon" :src="activeGameIcon" alt="" />
        <span v-else>{{ activeGameTitle.slice(0, 1) }}</span>
      </button>
      <nav>
        <button v-for="item in nav" :key="item.id" class="nav-button" :class="{ active: app.state.view === item.id }" :title="item.label" @click="app.setView(item.id)">
          <component :is="item.icon" :size="21" /><span>{{ item.label }}</span>
        </button>
      </nav>
      <button v-if="importing.supported.value" class="nav-button import-game-nav" :title="importing.state.task || importing.state.uncertain ? '查看导入进度或结果' : '导入游戏'" @click="importing.openWizard()"><FolderOpen :size="21" /><span>{{ importing.state.task || importing.state.uncertain ? '导入进度' : '导入游戏' }}</span><i v-if="importing.pending.value" class="import-task-dot" aria-label="正在导入"></i></button>
      <button class="nav-button settings-bottom" :class="{ active: app.state.view === 'settings' }" title="设置" @click="app.setView('settings')"><Settings class="animated-settings-icon" :size="21" /></button>
    </aside>

    <section class="workspace">
      <template v-if="app.state.view !== 'launcher' && activeGameBackground">
        <Transition name="background-crossfade">
          <img :key="activeGameBackground" class="workspace-tab-background" :src="activeGameBackground" alt="" decoding="async" />
        </Transition>
        <div class="workspace-tab-background-shade"></div>
      </template>
      <div
        class="top-game-strip"
        aria-hidden="true"
        @pointerenter="keepGameRailAlive"
        @pointerleave="scheduleGameRailClose"
        @pointerdown="prepareWindowDrag"
        @pointermove="continueWindowDrag"
        @pointerup="cancelWindowDrag"
        @pointercancel="cancelWindowDrag"
        @dblclick="toggleWindowMaximize"
      ></div>
      <GameRail :open="gameRailOpen || gameCatalogOpen" @pointer-enter="keepGameRailAlive" @pointer-leave="scheduleGameRailClose" @catalog-change="setGameCatalogOpen" />
      <div v-if="app.state.connection === 'disconnected'" class="offline-panel">
        <WifiOff :size="34" /><h2>工具后端未连接</h2><p>请确认工具正在运行，然后重试。</p><div class="inline"><button class="primary" @click="reconnect">重新连接</button><button class="ghost" @click="openExternal('https://kkeygenn.feishu.cn/wiki/W3IfwUkUki6cYqkJ5grckRmvnWb')"><CircleHelp :size="17" /> 常见问题</button></div>
      </div>
      <div v-else class="view-host">
        <Transition name="page-change" mode="out-in">
          <KeepAlive>
            <component :is="activeViewComponent" :key="app.state.view" />
          </KeepAlive>
        </Transition>
      </div>
    </section>

    <Transition name="status-fade">
      <div v-if="app.state.connection !== 'connected' || app.state.updateRequired" class="status-pill" :class="app.state.connection">
        <span class="status-dot"></span>
        {{ app.state.updateRequired ? '有功能需要更新工具' : app.state.connection === 'connected' ? '工具已连接' : app.state.connection === 'disconnected' ? '工具未连接' : '正在连接' }}
      </div>
    </Transition>
    <TransitionGroup name="toast-list" tag="div" class="toasts">
      <div v-for="notice in app.state.notices" :key="notice.id" class="toast" :class="notice.tone">{{ notice.message }}</div>
    </TransitionGroup>
    <AccountSwitchingWizard v-if="switching.supported.value" />
    <ImportGameWizard v-if="importing.supported.value" />
    <AppDialogHost />
  </main>
</template>
