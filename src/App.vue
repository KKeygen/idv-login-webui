<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { Gamepad2, Home, Users, Settings, Cloud, Download, WifiOff, CircleHelp } from '@lucide/vue'
import { openExternal } from './api'
import { useAppStore } from './composables/useAppStore'
import GameRail from './components/GameRail.vue'
import LauncherView from './components/LauncherView.vue'
import AccountsView from './components/AccountsView.vue'
import SettingsView from './components/SettingsView.vue'
import CloudSyncView from './components/CloudSyncView.vue'

const app = useAppStore()
const nav = [
  { id: 'launcher', label: '游戏启动器', icon: Home },
  { id: 'accounts', label: '账号管理', icon: Users },
  { id: 'settings', label: '设置', icon: Settings },
  { id: 'cloud', label: '云同步', icon: Cloud },
]

let statusTimer
onMounted(async () => {
  try { await app.loadGames(); await app.refreshCurrent() } catch {}
  statusTimer = setInterval(() => app.loadGames().catch(() => {}), 3000)
})
onBeforeUnmount(() => clearInterval(statusTimer))
</script>

<template>
  <main class="shell">
    <aside class="sidebar">
      <div class="brand" title="网易渠道服工具"><Gamepad2 :size="25" /></div>
      <nav>
        <button v-for="item in nav" :key="item.id" class="nav-button" :class="{ active: app.state.view === item.id }" :title="item.label" @click="app.setView(item.id)">
          <component :is="item.icon" :size="21" /><span>{{ item.label }}</span>
        </button>
      </nav>
      <button class="nav-button settings-bottom" :class="{ active: app.state.view === 'settings' }" title="设置" @click="app.setView('settings')"><Settings :size="21" /></button>
    </aside>

    <section class="workspace">
      <GameRail />
      <div v-if="app.state.connection === 'disconnected'" class="offline-panel">
        <WifiOff :size="34" /><h2>工具后端未连接</h2><p>请确认工具正在运行，然后重试。</p><div class="inline"><button class="primary" @click="app.loadGames().then(app.refreshCurrent)">重新连接</button><button class="ghost" @click="openExternal('https://www.yuque.com/keygen/kg2r5k/xl9zosrwviyc54nu')"><CircleHelp :size="17" /> 常见问题</button></div>
      </div>
      <template v-else>
        <LauncherView v-if="app.state.view === 'launcher'" />
        <AccountsView v-else-if="app.state.view === 'accounts'" />
        <SettingsView v-else-if="app.state.view === 'settings'" />
        <CloudSyncView v-else />
      </template>
    </section>

    <div class="status-pill" :class="app.state.connection">
      <span class="status-dot"></span>
      {{ app.state.updateRequired ? '有功能需要更新工具' : app.state.connection === 'connected' ? '工具已连接' : '正在连接' }}
    </div>
    <div class="toasts">
      <div v-for="notice in app.state.notices" :key="notice.id" class="toast" :class="notice.tone">{{ notice.message }}</div>
    </div>
  </main>
</template>
