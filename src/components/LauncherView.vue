<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Clock3, Download, FolderOpen, PackageOpen, Pause, Play, Settings, Newspaper, ShieldCheck } from '@lucide/vue'
import { openExternal, request, resolveTask, resourceUrl } from '../api'
import { useAppStore } from '../composables/useAppStore'
import { showConfirm } from '../dialogService'
import GameSettingsModal from './GameSettingsModal.vue'

const app = useAppStore()
const distributionId = computed({ get: () => app.state.distributionId, set: value => app.setDistribution(value) })
const showNews = ref(localStorage.getItem('idv.news.visible') !== 'false')
const gameSettingsOpen = ref(false)
const targetDir = ref('')
const targetStatus = ref(null)
const activeTaskId = ref('')
const downloadStatus = ref(null)
const controlPending = ref('')
const now = ref(Date.now())
let downloadGeneration = 0
let clockTimer = null
const launcherReady = computed(() => Boolean(app.state.launcher?.game_id))

const distributions = computed(() => app.state.launcher?.distributions || [])
const distribution = computed(() => distributions.value.find(item => String(item.distribution_id) === String(distributionId.value)) || distributions.value[0] || null)
const installation = computed(() => distribution.value?.installation || null)
const installationId = computed(() => installation.value?.installation_id || '')
const installed = computed(() => Boolean(installation.value?.installed))
const needsUpdate = computed(() => Boolean(distribution.value?.needs_update))
const fever = computed(() => distribution.value?.fever || {})
const canImportFever = computed(() => Boolean(distribution.value?.can_import_fever))
const installRequirements = computed(() => distribution.value?.install_requirements || {})
const downloadActive = computed(() => Boolean(activeTaskId.value && downloadStatus.value?.status === 'pending'))
const downloadPaused = computed(() => Number(downloadStatus.value?.state) === 6 || String(downloadStatus.value?.phase || '') === '下载已暂停')
const downloadPercent = computed(() => Math.max(0, Math.min(100, Number(downloadStatus.value?.progress_percent) || 0)))
const downloadElapsed = computed(() => {
  const startedAt = Number(downloadStatus.value?.created_at) * 1000
  return formatDuration(startedAt ? Math.max(0, now.value - startedAt) : 0)
})
const downloadStages = computed(() => downloadStatus.value?.stages || {})
const sharedLauncher = computed(() => ({
  ...(app.currentGame.value?.launcher || {}),
  ...(app.state.launcherVisual || {}),
  ...(distributions.value.map(item => item.launcher || {}).find(item => item.background_image || item.main_image || item.logo || item.display_name) || {}),
}))
function mergeLauncher(primary = {}) {
  const merged = { ...sharedLauncher.value }
  for (const [key, value] of Object.entries(primary || {})) if (value !== null && value !== '' && value !== undefined) merged[key] = value
  return merged
}
const launcher = computed(() => mergeLauncher(distribution.value?.launcher))
const hero = computed(() => resourceUrl(launcher.value.background_image || launcher.value.main_image || ''))
const brandLogo = computed(() => resourceUrl(launcher.value.game_library_logo || launcher.value.logo || ''))
const newsCover = computed(() => resourceUrl(launcher.value.main_image || ''))
const title = computed(() => launcher.value.display_name || launcher.value.app_name || app.currentGame.value?.display_name || app.currentGame.value?.app_name || '游戏启动器')
const news = computed(() => launcher.value.activities_and_news?.tops || launcher.value.news || app.currentGame.value?.news || [])
const newsMoreUrl = computed(() => launcher.value.activities_and_news?.more_url || '')
const brandButtonStyle = computed(() => {
  const gradient = String(launcher.value.button_gradient || '')
  const stops = [...gradient.matchAll(/stop:\d+(?:\.\d+)?\s+(#[0-9a-f]{6,8})/gi)].map(match => match[1])
  // Some launcher records publish both button_color and a decorative
  // multi-stop gradient.  The shared capsule deliberately uses one flat
  // colour so its two hit targets never look like separate buttons.
  const background = launcher.value.button_color || stops[0] || ''
  return background ? { '--brand-button': background, '--brand-button-text': launcher.value.button_text_color || '#fff' } : {}
})

function formatNewsDate(value) { return value ? new Date(Number(value) * 1000).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : '' }
watch(distributions, list => {
  const preferred = app.state.launcher?.game?.default_distribution
  if (!list.some(item => String(item.distribution_id) === app.state.distributionId)) app.setDistribution(list.find(item => item.distribution_id === preferred)?.distribution_id ?? list[0]?.distribution_id ?? '')
}, { immediate: true })
watch(
  [() => app.state.gameId, distributionId, () => distribution.value?.active_task],
  ([gameId, selectedDistribution, task], previous = []) => {
    const selectionChanged = previous.length && (
      gameId !== previous[0] || selectedDistribution !== previous[1]
    )
    if (selectionChanged) {
      downloadGeneration += 1
      activeTaskId.value = ''
      downloadStatus.value = null
      controlPending.value = ''
      targetDir.value = ''
      targetStatus.value = null
    }
    if (!task?.task_id || task.status !== 'pending') return
    if (task.task_id === activeTaskId.value && downloadStatus.value?.status === 'pending') {
      downloadStatus.value = { ...downloadStatus.value, ...task }
      return
    }
    monitorDownload(task.task_id, task)
  },
  { immediate: true },
)

onMounted(() => { clockTimer = setInterval(() => { now.value = Date.now() }, 1000) })
onBeforeUnmount(() => { clearInterval(clockTimer); downloadGeneration += 1 })

async function inspectTargetPath(path) {
  return path
    ? request('/native/path-status', { query: { path } })
    : null
}

async function chooseDirectory() {
  const picked = await app.guarded('pick-directory', async () => {
    const pending = await request('/native/pick-directory', { method: 'POST', body: { title: `选择${title.value}安装目录`, default_path: targetDir.value } })
    return resolveTask(pending, '/native/task-status')
  }, { optional: true })
  if (!picked || picked.cancelled || !picked.path) return ''
  const path = picked.path
  const status = await inspectTargetPath(path)
  // Commit the path and its capacity snapshot in one Vue update.  This avoids
  // rendering a newly selected D: path beside the previous C: volume status.
  targetDir.value = path
  targetStatus.value = status
  return path
}

function beginDownload(task, kind) {
  if (!task?.task_id) return
  monitorDownload(task.task_id, {
    ...task,
    kind,
    created_at: task.created_at || Math.floor(Date.now() / 1000),
    phase: task.phase || '正在准备下载…',
    progress_percent: task.progress_percent || 0,
  })
}

async function monitorDownload(taskId, initial = {}) {
  const generation = ++downloadGeneration
  activeTaskId.value = taskId
  downloadStatus.value = { status: 'pending', ...initial, task_id: taskId }
  controlPending.value = ''
  while (generation === downloadGeneration && activeTaskId.value === taskId) {
    try {
      const status = await request('/native/task-status', { query: { task_id: taskId } })
      if (generation !== downloadGeneration || activeTaskId.value !== taskId) return
      downloadStatus.value = { ...downloadStatus.value, ...status }
      if (
        (controlPending.value === 'pause' && status.state === 6)
        || (controlPending.value === 'resume' && status.state !== 6)
      ) controlPending.value = ''
      if (status.status !== 'pending') {
        activeTaskId.value = ''
        controlPending.value = ''
        await app.refreshCurrent()
        if (status.success) app.notify(status.kind === 'launcher-update' ? '游戏更新完成' : '游戏下载完成', 'success')
        else app.notify(status.error || '游戏下载失败', 'error')
        return
      }
    } catch (error) {
      if (generation !== downloadGeneration) return
      app.notify(error.message || '获取下载进度失败', 'error')
      return
    }
    await new Promise(resolve => setTimeout(resolve, 750))
  }
}

async function toggleDownload() {
  if (!downloadActive.value || controlPending.value) return
  const action = downloadPaused.value ? 'resume' : 'pause'
  controlPending.value = action
  downloadStatus.value = {
    ...downloadStatus.value,
    phase: action === 'pause' ? '正在暂停…' : '正在恢复…',
  }
  try {
    await request('/native/download-control', {
      method: 'POST',
      body: { task_id: activeTaskId.value, action },
    })
  } catch (error) {
    controlPending.value = ''
    app.notify(error.message || '下载控制失败', 'error')
  }
}

async function openInstall() {
  targetDir.value = ''
  targetStatus.value = null
  const path = await chooseDirectory()
  if (path) await install()
}
async function install() {
  if (!targetDir.value) return chooseDirectory()
  if (targetStatus.value?.disk_free_bytes < (installRequirements.value.download_bytes || 0)) {
    app.notify(`所选磁盘空间不足，至少需要 ${formatSize(installRequirements.value.download_bytes || 0)}`, 'error')
    return
  }
  await app.guarded('install', async () => {
    const pending = await request('/launcher-install', {
      query: { game_id: app.state.gameId, distribution_id: distributionId.value },
      body: { target_dir: targetDir.value, concurrent: 4 },
    })
    if (pending?.success === false) throw new Error(pending.error || '启动游戏下载失败')
    if (pending?.status === 'pending' && pending.task_id) {
      beginDownload(pending, 'launcher-install')
      app.refreshCurrent().catch(() => {})
      app.notify('游戏下载已在后台开始', 'success')
    } else {
      await app.refreshCurrent()
      app.notify('游戏文件已就绪', 'success')
    }
    return pending
  }, { optional: true })
}
async function locate() {
  const picked = await app.guarded('pick-game', async () => {
    const pending = await request('/native/pick-executable', { method: 'POST', body: { title: `定位${title.value}启动程序` } })
    return resolveTask(pending, '/native/task-status')
  }, { optional: true })
  if (!picked || picked.cancelled || !picked.path) return
  await app.mutate('locate-game', '/launcher-locate', { method: 'POST', body: { game_id: app.state.gameId, path: picked.path } }, { optional: true })
}
async function update() {
  if (!installed.value || !distribution.value?.can_update) return
  gameSettingsOpen.value = false
  await app.guarded('update', async () => {
    const pending = await request('/launcher-update', { query: { game_id: app.state.gameId, distribution_id: distributionId.value, installation_id: installationId.value } })
    if (pending?.success === false) throw new Error(pending.error || '游戏更新失败')
    if (pending?.status === 'pending' && pending.task_id) {
      beginDownload(pending, 'launcher-update')
      app.refreshCurrent().catch(() => {})
      app.notify('游戏更新已在后台开始', 'success')
    } else {
      await app.refreshCurrent()
      app.notify('游戏更新完成', 'success')
    }
  }, { optional: true })
}
async function start() { await app.mutate('start', '/start-game', { query: { game_id: app.state.gameId, installation_id: installationId.value } }) }
async function remove() {
  if (!installation.value) return
  const confirmed = await showConfirm('只删除启动器中的安装记录，不会删除磁盘中的游戏文件。', { title: '移除安装记录', confirmText: '移除', danger: true })
  if (!confirmed) return
  await app.mutate('remove-install', '/launcher-remove-installation', { query: { game_id: app.state.gameId, installation_id: installationId.value } })
  gameSettingsOpen.value = false
}
async function importFever() {
  await app.mutate('fever', '/launcher-import-fever', {
    query: {
      game_id: app.state.gameId,
      distribution_id: fever.value.distribution_id ?? distributionId.value ?? -1,
      path: fever.value.path || '',
    },
  }, {
    startMessage: '正在从发烧平台读取并校验游戏记录…',
    successMessage: '已从发烧平台导入游戏',
  })
}
async function importFeverList() {
  const data = await request('/fever-games')
  const item = (data.games || []).find(row => row.game_id === app.state.gameId || row.matched_game_id === app.state.gameId) || data.games?.[0]
  if (!item) return app.notify('没有找到可导入的发烧游戏平台记录', 'warning')
  await app.mutate('fever-list', '/launcher-import-fever', { query: { game_id: item.matched_game_id || item.game_id, distribution_id: item.distribution_id ?? -1, path: item.path || '' } }, {
    startMessage: '正在从发烧平台读取并校验游戏记录…',
    successMessage: '已从发烧平台导入游戏',
  })
}
async function locateFromSettings() { gameSettingsOpen.value = false; await locate() }
async function importFeverFromSettings() { gameSettingsOpen.value = false; await importFever() }
async function importFeverListFromSettings() { gameSettingsOpen.value = false; await importFeverList() }
function toggleNews() { showNews.value = !showNews.value; localStorage.setItem('idv.news.visible', String(showNews.value)) }
function formatSize(bytes) { if (!bytes) return '0 B'; const i = Math.floor(Math.log(bytes) / Math.log(1024)); return `${(bytes / 1024 ** i).toFixed(1)} ${['B','KB','MB','GB','TB'][i]}` }
function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  return [hours, minutes, rest].map(value => String(value).padStart(2, '0')).join(':')
}
function stageAmount(stage = {}) {
  if (Number(stage.total_bytes) > 0) return `${formatSize(stage.completed_bytes || 0)}/${formatSize(stage.total_bytes)}`
  return `${Math.round(Number(stage.percent) || 0)}%`
}
function stageRate(stage = {}) {
  const rate = String(stage.rate || '')
  return rate && rate !== 'N/A' ? rate : '—'
}
function downloadPhaseLabel(phase, fallback = '正在处理…') {
  const key = String(phase || '').trim()
  const labels = {
    preparing: '正在准备下载…',
    checking: '正在检查现有文件…',
    download_started: '下载核心已启动…',
    downloading: '正在下载文件…',
    verifying: '正在校验文件…',
    building: '正在写入文件…',
    finalizing: '正在完成安装…',
    paused: '下载已暂停',
    retrying: '网络异常，正在重试…',
    finished: '下载完成',
    failed: '下载失败',
  }
  if (labels[key]) return labels[key]
  return key && !/^[\x00-\x7f]+$/.test(key) ? key : fallback
}
</script>

<template>
  <section :key="app.state.gameId" class="launcher-view">
    <img v-if="hero" class="launcher-hero-image" :src="hero" alt="" decoding="async" fetchpriority="high" />
    <div class="hero-shade"></div>
    <section class="launcher-identity">
      <img v-if="brandLogo" class="launcher-brand-logo" :src="brandLogo" :alt="title" decoding="async" />
      <h1 v-else>{{ title }}</h1>
    </section>

    <div class="launcher-bottom">
      <section v-if="showNews" class="news-card glass">
        <img v-if="newsCover" class="news-cover" :src="newsCover" alt="" loading="lazy" decoding="async" />
        <header><div><Newspaper :size="18" /> 新闻</div><button class="ghost compact" @click="toggleNews">隐藏</button></header>
        <template v-if="news.length"><a v-for="item in news.slice(0, 3)" :key="item.id || item.url || item.title" href="#" @click.prevent="openExternal(item.url)"><span>{{ item.title }}</span><time>{{ formatNewsDate(item.release_time) }}</time></a><button v-if="newsMoreUrl" class="news-more" @click="openExternal(newsMoreUrl)">查看更多</button></template>
        <p v-else class="muted">当前游戏暂无新闻。可在设置中隐藏此面板。</p>
      </section>

      <div class="launcher-controls" :class="{ 'download-active': downloadActive }">
        <section v-if="downloadActive" class="download-flyout">
          <header>
            <strong>{{ downloadPaused ? '已暂停' : '下载中' }}</strong>
            <span>{{ downloadPercent.toFixed(1) }}%</span>
            <span class="download-elapsed"><Clock3 :size="14" />{{ downloadElapsed }}</span>
          </header>
          <small>{{ downloadPhaseLabel(downloadStatus?.phase, '正在处理游戏文件…') }}</small>
          <div class="download-stage-row"><Download :size="17" /><span>下载</span><b>{{ stageAmount(downloadStages.download) }}</b><em>{{ stageRate(downloadStages.download) }}</em></div>
          <div class="download-stage-row"><PackageOpen :size="17" /><span>安装</span><b>{{ stageAmount(downloadStages.install) }}</b><em>{{ stageRate(downloadStages.install) }}</em></div>
          <div class="download-stage-row"><ShieldCheck :size="17" /><span>校验</span><b>{{ stageAmount(downloadStages.verify) }}</b><em>{{ stageRate(downloadStages.verify) }}</em></div>
        </section>
        <div class="launch-actions" :class="{ 'has-download': downloadActive }" :style="brandButtonStyle">
          <span v-if="downloadActive" class="download-percent-orb">{{ Math.floor(downloadPercent) }}</span>
          <button v-if="downloadActive" class="primary large download-toggle" :disabled="Boolean(controlPending)" @click="toggleDownload">
            <span class="download-collapsed-label"><span><Download :size="18" />下载中</span><small><Clock3 :size="13" />{{ downloadElapsed }}</small></span>
            <span class="download-control-label"><Play v-if="downloadPaused" :size="18" /><Pause v-else :size="18" />{{ controlPending === 'pause' ? '正在暂停' : controlPending === 'resume' ? '正在恢复' : downloadPaused ? '继续下载' : '暂停' }}</span>
          </button>
          <button v-else-if="!launcherReady" class="primary large" disabled>正在读取游戏状态…</button>
          <button v-else-if="installed && needsUpdate" class="primary large" :disabled="Boolean(app.state.busy)" @click="update"><Download /> 更新游戏</button>
          <button v-else-if="installed" class="primary large" :disabled="Boolean(app.state.busy)" @click="start"><Play /> 开始游戏</button>
          <button v-else-if="canImportFever" class="primary large" :disabled="Boolean(app.state.busy)" @click="importFever"><Download /> {{ app.state.busy === 'fever' ? '正在导入…' : '从发烧平台导入' }}</button>
          <button v-else-if="distribution?.can_download" class="primary large" :disabled="Boolean(app.state.busy)" @click="openInstall"><Download /> 下载游戏</button>
          <button v-else class="primary large" :disabled="Boolean(app.state.busy)" @click="locate"><FolderOpen /> 选择游戏路径</button>
          <button class="icon-button game-settings-button" title="游戏设置" @click="gameSettingsOpen = true"><Settings /></button>
        </div>
        <button v-if="!installed && !canImportFever && distribution?.can_download" class="locate-existing" :disabled="Boolean(app.state.busy)" @click="locate"><FolderOpen :size="15" /> 已有游戏文件？选择游戏路径</button>
      </div>
    </div>

    <GameSettingsModal
      :open="gameSettingsOpen"
      :title="title"
      @close="gameSettingsOpen = false"
      @update="update"
      @locate="locateFromSettings"
      @remove="remove"
      @import-fever="importFeverFromSettings"
      @import-fever-list="importFeverListFromSettings"
    />
  </section>
</template>
