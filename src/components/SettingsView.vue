<script setup>
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, reactive, ref, watch } from 'vue'
import { FileText, Network, RotateCcw, Settings2, Terminal, Wrench } from '@lucide/vue'
import { ApiError, request } from '../api'
import { useAppStore } from '../composables/useAppStore'
import { showConfirm } from '../dialogService'
import HelpTip from './HelpTip.vue'
import MotionProgressRing from './MotionProgressRing.vue'

const app = useAppStore()
const activeSection = ref('general')
const sections = [
  { id: 'general', label: '常规', description: '账号记录和内容显示', icon: Settings2 },
  { id: 'network', label: '网络', description: '代理与游戏网络接管方式', icon: Network },
  { id: 'diagnostics', label: '诊断', description: '实时输出、日志导出与状态重置', icon: Wrench },
]
const currentSection = computed(() => sections.find(item => item.id === activeSection.value))
const form = reactive({
  scanRecord: true,
  scanSupported: true,
  nativeSave: false,
  nativeSupported: true,
  proxyMode: 'global',
  newsVisible: localStorage.getItem('idv.news.visible') !== 'false',
})
const terminalOutput = ref('')
const terminalCursor = ref(0)
const terminalSupported = ref(true)
const terminalBox = ref(null)
const resetting = ref(false)
const loading = ref(true)
let terminalTimer = null
let terminalGeneration = 0
let viewActive = true

async function optional(path, options, unsupportedKey) {
  try { return await request(path, options) }
  catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      form[unsupportedKey] = false
      app.markUpdateRequired()
      return null
    }
    throw error
  }
}
async function load() {
  loading.value = true
  try {
    const [scan, native, proxy] = await Promise.allSettled([
      optional('/scan-record-setting', {}, 'scanSupported'),
      optional('/native-save-setting', {}, 'nativeSupported'),
      request('/proxy-mode'),
    ])
    if (scan.status === 'fulfilled' && scan.value && 'enabled' in scan.value) form.scanRecord = Boolean(scan.value.enabled)
    if (native.status === 'fulfilled' && native.value && 'enabled' in native.value) form.nativeSave = Boolean(native.value.enabled)
    if (proxy.status === 'fulfilled' && 'mode' in proxy.value) form.proxyMode = proxy.value.mode
  } finally {
    loading.value = false
  }
}
async function toggleScan() {
  const data = await request('/scan-record-setting', { method: 'POST', body: { enabled: !form.scanRecord } })
  if (data.success === false) throw new Error(data.error)
  form.scanRecord = Boolean(data.enabled)
  if ('native_save_enabled' in data) form.nativeSave = Boolean(data.native_save_enabled)
  app.notify('扫码记录设置已保存', 'success')
}
async function toggleNative() {
  if (!form.scanRecord && !form.nativeSave) return app.notify('请先开启扫码记录', 'warning')
  const data = await request('/native-save-setting', { method: 'POST', body: { enabled: !form.nativeSave } })
  if (data.success === false) throw new Error(data.error)
  form.nativeSave = Boolean(data.enabled)
  app.notify('原生保存设置已保存', 'success')
}
async function setProxy() {
  const data = await request('/set-proxy-mode', { method: 'POST', body: { mode: form.proxyMode } })
  if (data.success) app.notify('代理模式已保存，重启工具后生效', 'success')
}
async function exportLogs() {
  const data = await request('/export-logs')
  app.notify(data.path ? `日志已导出：${data.path}` : '日志已导出', 'success')
}
function stopTerminal() {
  terminalGeneration += 1
  if (terminalTimer) clearTimeout(terminalTimer)
  terminalTimer = null
}
async function pollTerminal(generation) {
  if (
    generation !== terminalGeneration
    || !viewActive
    || activeSection.value !== 'diagnostics'
    || !terminalSupported.value
  ) return
  const element = terminalBox.value
  const pinnedToBottom = !element || element.scrollHeight - element.scrollTop - element.clientHeight < 48
  try {
    const data = await request('/diagnostics/terminal', { query: { cursor: terminalCursor.value } })
    if (generation !== terminalGeneration || !viewActive || activeSection.value !== 'diagnostics') return
    terminalOutput.value = data.reset
      ? String(data.output || '')
      : terminalOutput.value + String(data.output || '')
    terminalCursor.value = Number(data.cursor || 0)
    if (pinnedToBottom) {
      await nextTick()
      if (generation === terminalGeneration && terminalBox.value) {
        terminalBox.value.scrollTop = terminalBox.value.scrollHeight
      }
    }
  } catch (error) {
    if (generation !== terminalGeneration) return
    if (error instanceof ApiError && error.status === 404) {
      terminalSupported.value = false
      app.markUpdateRequired()
    }
  } finally {
    if (
      generation === terminalGeneration
      && viewActive
      && activeSection.value === 'diagnostics'
      && terminalSupported.value
    ) {
      terminalTimer = setTimeout(() => pollTerminal(generation), 750)
    }
  }
}
function startTerminal() {
  stopTerminal()
  if (viewActive && terminalSupported.value) pollTerminal(terminalGeneration)
}
function clearTerminalView() {
  terminalOutput.value = ''
}
async function resetToolState() {
  const confirmed = await showConfirm(
    '这会删除 config.json，并清除游戏路径、启动偏好等全部工具设置。工具随后会立即重启，并重新检查和应用热更新。\n\n此操作无法撤销。',
    { title: '重置工具状态', confirmText: '删除并重启', danger: true },
  )
  if (!confirmed) return
  resetting.value = true
  try {
    await request('/diagnostics/reset-state', { method: 'POST', body: { confirmed: true } })
    app.notify('工具状态已清除，正在重启', 'warning')
  } catch (error) {
    resetting.value = false
    app.notify(error?.message || '重置工具状态失败', 'error')
  }
}
function setNews() {
  localStorage.setItem('idv.news.visible', String(form.newsVisible))
  app.notify('新闻显示设置已保存', 'success')
}
onMounted(load)
onActivated(() => {
  viewActive = true
  if (activeSection.value === 'diagnostics') startTerminal()
})
onDeactivated(() => {
  viewActive = false
  stopTerminal()
})
watch(activeSection, section => {
  if (section === 'diagnostics') startTerminal()
  else stopTerminal()
})
onBeforeUnmount(() => { viewActive = false; stopTerminal() })
</script>

<template>
  <section class="content-page settings-page">
    <div class="settings-layout">
      <aside class="settings-subnav glass">
        <header><p class="eyebrow">偏好设置</p><h1>应用设置</h1></header>
        <nav>
          <button v-for="section in sections" :key="section.id" :class="{ active: activeSection === section.id }" @click="activeSection = section.id">
            <component :is="section.icon" :size="20" />
            <span><strong>{{ section.label }}</strong></span>
          </button>
        </nav>
      </aside>

      <section class="settings-content">
        <Transition name="section-change" mode="out-in">
          <div :key="activeSection" class="settings-section-host">
            <header class="settings-section-title"><h1>{{ currentSection.label }}</h1><p>{{ currentSection.description }}</p></header>
            <div v-if="loading" class="content-loading settings-loading"><MotionProgressRing :size="32" aria-label="正在读取应用设置" /><span>正在读取设置…</span></div>
            <article v-else-if="activeSection === 'general'" class="settings-card glass">
          <header><Settings2 :size="20" /><div><h2>工具行为</h2><p>这些设置对所有游戏生效。</p></div></header>
          <label v-if="form.scanSupported" class="setting-row"><span><strong class="setting-title-with-help">保存扫码账号记录 <HelpTip text="扫码登录成功后，将该账号的渠道、账号标识和必要登录记录保存到工具的本地账号列表，便于下次直接切换。关闭后，新扫码的账号不会加入工具记录。" /></strong><small>保存到工具的本地账号列表</small></span><input type="checkbox" :checked="form.scanRecord" @change="toggleScan" /></label>
          <label v-if="form.nativeSupported" class="setting-row"><span><strong class="setting-title-with-help">同步保存到游戏原生记录 <HelpTip text="在工具保存扫码账号的同时，将兼容的账号记录写入游戏或官方登录组件维护的本地列表，使它也能在原生账号选择界面中出现。此选项依赖‘保存扫码账号记录’。" /></strong><small>同时写入兼容的原生账号列表</small></span><input type="checkbox" :checked="form.nativeSave" :disabled="!form.scanRecord" @change="toggleNative" /></label>
          <label class="setting-row"><span><strong>显示启动器新闻</strong><small>关闭后启动器主界面不显示新闻面板</small></span><input v-model="form.newsVisible" type="checkbox" @change="setNews" /></label>
        </article>
        <article v-else-if="activeSection === 'network'" class="settings-card glass">
          <header><Network :size="20" /><div><h2>代理模式</h2><p>修改后通常需要重启工具。</p></div></header>
          <label class="field"><span class="field-label-with-help">网络接管方式 <HelpTip text="全局代理使用系统代理接管相关请求；仅游戏进程将影响限制在游戏及登录组件；兼容模式使用本地 DNS 和直连规则，适用于主要通过浏览器访问启动器的场景。修改后需重启工具才能完整生效。" /></span><select v-model="form.proxyMode"><option value="global">全局代理</option><option value="process">仅游戏进程</option><option value="compat">兼容模式</option></select></label>
          <button class="primary wide" @click="setProxy">保存代理模式</button>
        </article>
        <article v-else class="settings-card diagnostics-panel">
          <header><FileText :size="20" /><div><h2>诊断工具</h2><p>查看实时输出或导出完整日志，方便定位运行问题。</p></div></header>
          <div class="diagnostics-actions">
            <button class="quiet-button" @click="exportLogs"><FileText :size="17" />导出诊断日志</button>
            <button class="quiet-button" @click="app.loadGames().then(() => app.refreshCurrent({ all: true, force: true }))">刷新全部数据</button>
          </div>

          <section class="diagnostics-terminal" aria-label="工具实时输出">
            <header>
              <span><Terminal :size="16" />工具实时输出</span>
              <span v-if="terminalSupported" class="terminal-live"><i />实时</span>
              <span v-else class="terminal-unavailable">需要更新工具</span>
              <button class="text-button" type="button" @click="clearTerminalView">清空显示</button>
            </header>
            <pre ref="terminalBox" aria-live="polite">{{ terminalSupported ? (terminalOutput || '等待工具输出…') : '当前工具版本不支持实时输出。' }}</pre>
          </section>

          <section class="diagnostics-reset-row">
            <div>
              <strong>重置工具状态</strong>
              <small>删除 config.json，清除游戏路径等全部设置并重启；重启后会重新检查和应用热更新。</small>
            </div>
            <button class="quiet-button danger" :disabled="resetting" @click="resetToolState">
              <MotionProgressRing v-if="resetting" :size="16" aria-label="正在重启工具" /><RotateCcw v-else :size="16" />{{ resetting ? '正在重启…' : '重置工具状态' }}
            </button>
          </section>
            </article>
          </div>
        </Transition>
      </section>
    </div>
  </section>
</template>
