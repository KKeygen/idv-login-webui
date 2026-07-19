<script setup>
import { onMounted, reactive } from 'vue'
import { Play, FolderOpen, Power, QrCode, Save, Network, FileText, Link, Newspaper } from '@lucide/vue'
import { ApiError, request, resolveTask } from '../api'
import { useAppStore } from '../composables/useAppStore'

const app = useAppStore()
const form = reactive({
  delay: 0, autoStart: false, autoStartPath: '', independentPath: false,
  scanRecord: true, scanSupported: true, nativeSave: false, nativeSupported: true,
  proxyMode: 'global', newsVisible: localStorage.getItem('idv.news.visible') !== 'false',
})

async function optional(path, options, unsupportedKey) {
  try { return await request(path, options) }
  catch (error) { if (error instanceof ApiError && error.status === 404) { form[unsupportedKey] = false; app.markUpdateRequired(); return null } throw error }
}
async function load() {
  const [delay, start, scan, native, proxy] = await Promise.allSettled([
    request('/get-login-delay', { query: { game_id: app.state.gameId } }),
    request('/get-game-auto-start', { query: { game_id: app.state.gameId } }),
    optional('/scan-record-setting', {}, 'scanSupported'),
    optional('/native-save-setting', {}, 'nativeSupported'),
    request('/proxy-mode'),
  ])
  if (delay.status === 'fulfilled' && 'delay' in delay.value) form.delay = delay.value.delay
  if (start.status === 'fulfilled') {
    if ('enabled' in start.value) form.autoStart = Boolean(start.value.enabled)
    if ('path' in start.value) form.autoStartPath = start.value.path || ''
    form.independentPath = 'independent_path_config' in start.value && Boolean(start.value.independent_path_config)
  }
  if (scan.status === 'fulfilled' && scan.value && 'enabled' in scan.value) form.scanRecord = Boolean(scan.value.enabled)
  if (native.status === 'fulfilled' && native.value && 'enabled' in native.value) form.nativeSave = Boolean(native.value.enabled)
  if (proxy.status === 'fulfilled' && 'mode' in proxy.value) form.proxyMode = proxy.value.mode
}
async function setAutoStart(enabled, updateMode = '') {
  let result = await request('/set-game-auto-start', { query: { game_id: app.state.gameId, enabled, ...(updateMode ? { update_mode: updateMode } : {}) } })
  result = await resolveTask(result)
  if (result.cancelled) return
  if (result.success === false) throw new Error(result.error || '设置失败')
  if ('enabled' in result) form.autoStart = Boolean(result.enabled)
  if ('path' in result) form.autoStartPath = result.path || ''
  await app.refreshCurrent(); app.notify('启动设置已保存', 'success')
}
async function saveDelay() { await app.mutate('delay', '/set-login-delay', { query: { game_id: app.state.gameId, delay: Math.max(0, Number(form.delay) || 0) } }, { reload: false }) }
async function toggleAutoClose() { const data = await app.mutate('auto-close', '/switch-auto-close-state', { query: { game_id: app.state.gameId } }, { reload: false }); if ('state' in data) app.setAutoClose(data.state) }
async function startGame() { await app.mutate('start-game', '/start-game', { query: { game_id: app.state.gameId } }, { reload: false }) }
async function toggleScan() { const data = await request('/scan-record-setting', { method: 'POST', body: { enabled: !form.scanRecord } }); if (data.success === false) throw new Error(data.error); form.scanRecord = Boolean(data.enabled); if ('native_save_enabled' in data) form.nativeSave = Boolean(data.native_save_enabled); app.notify('扫码记录设置已保存', 'success') }
async function toggleNative() { if (!form.scanRecord && !form.nativeSave) return app.notify('请先开启扫码记录', 'warning'); const data = await request('/native-save-setting', { method: 'POST', body: { enabled: !form.nativeSave } }); if (data.success === false) throw new Error(data.error); form.nativeSave = Boolean(data.enabled); app.notify('原生保存设置已保存', 'success') }
async function setProxy() { const data = await request('/set-proxy-mode', { method: 'POST', body: { mode: form.proxyMode } }); if (data.success) app.notify('代理模式已保存，重启工具后生效', 'success') }
async function exportLogs() { const data = await request('/export-logs'); app.notify(data.path ? `日志已导出：${data.path}` : '日志已导出', 'success') }
async function shortcut() { await app.mutate('shortcut', '/create-game-shortcut', { method: 'POST', body: { game_id: app.state.gameId, installation_id: app.state.launcher?.game?.default_installation_id || '' } }, { reload: false, optional: true }) }
function setNews() { localStorage.setItem('idv.news.visible', String(form.newsVisible)); app.notify('新闻显示设置已保存', 'success') }
onMounted(load)
</script>

<template>
  <section class="content-page settings-page">
    <header class="page-title"><div><p class="eyebrow">偏好设置</p><h1>启动与工具设置</h1><p>只展示当前工具支持的能力；缺少的新接口会在右上角提示更新。</p></div></header>
    <div class="settings-grid">
      <article class="settings-card">
        <header><Play :size="20" /><div><h2>游戏启动</h2><p>自动启动、路径和登录等待。</p></div></header>
        <label class="setting-row"><span><strong>登录后自动启动游戏</strong><small>{{ form.autoStartPath || '尚未选择启动路径' }}</small></span><input type="checkbox" :checked="form.autoStart" @change="setAutoStart($event.target.checked, form.independentPath ? 'status_only' : '')" /></label>
        <button class="ghost wide" @click="setAutoStart(true, form.independentPath ? 'path_only' : '')"><FolderOpen :size="17" /> {{ form.autoStartPath ? '重新选择游戏路径' : '选择游戏路径' }}</button>
        <label class="field"><span>自动登录延迟（秒）</span><div class="inline"><input v-model.number="form.delay" type="number" min="0" /><button class="ghost" @click="saveDelay"><Save :size="16" /> 保存</button></div></label>
        <div class="inline"><button class="primary" @click="startGame"><Play :size="17" /> 立即启动</button><button class="ghost" @click="shortcut"><Link :size="17" /> 创建桌面快捷方式</button></div>
      </article>

      <article class="settings-card">
        <header><Power :size="20" /><div><h2>工具行为</h2><p>登录完成后的窗口和记录行为。</p></div></header>
        <label class="setting-row"><span><strong>登录成功后自动关闭工具</strong><small>当前游戏独立设置</small></span><input type="checkbox" :checked="app.state.autoClose" @change="toggleAutoClose" /></label>
        <label v-if="form.scanSupported" class="setting-row"><span><strong>保存扫码账号记录</strong><small>用于下次快速切换账号</small></span><input type="checkbox" :checked="form.scanRecord" @change="toggleScan" /></label>
        <label v-if="form.nativeSupported" class="setting-row"><span><strong>同步保存到游戏原生记录</strong><small>需要先开启扫码记录</small></span><input type="checkbox" :checked="form.nativeSave" :disabled="!form.scanRecord" @change="toggleNative" /></label>
        <label class="setting-row"><span><strong>显示启动器新闻</strong><small>关闭后启动器主界面不显示新闻卡片</small></span><input v-model="form.newsVisible" type="checkbox" @change="setNews" /></label>
      </article>

      <article class="settings-card">
        <header><Network :size="20" /><div><h2>代理模式</h2><p>修改后通常需要重启工具。</p></div></header>
        <label class="field"><span>网络接管方式</span><select v-model="form.proxyMode"><option value="global">全局代理</option><option value="process">仅游戏进程</option><option value="compat">兼容模式</option></select></label>
        <button class="primary wide" @click="setProxy">保存代理模式</button>
      </article>

      <article class="settings-card">
        <header><FileText :size="20" /><div><h2>诊断</h2><p>导出运行状态和日志，方便排查问题。</p></div></header>
        <button class="ghost wide" @click="exportLogs"><FileText :size="17" /> 导出诊断日志</button>
        <button class="ghost wide" @click="app.loadGames().then(app.refreshCurrent)">刷新全部数据</button>
      </article>
    </div>
  </section>
</template>
