<script setup>
import { computed, ref, watch } from 'vue'
import { Download, FolderOpen, HardDrive, Play, Settings, Newspaper, X } from '@lucide/vue'
import { openExternal, pollTask, request, resolveTask, resourceUrl } from '../api'
import { useAppStore } from '../composables/useAppStore'

const app = useAppStore()
const distributionId = computed({ get: () => app.state.distributionId, set: value => app.setDistribution(value) })
const installationId = ref('')
const updateInfo = ref(null)
const showNews = ref(localStorage.getItem('idv.news.visible') !== 'false')
const toolsOpen = ref(false)
const installOpen = ref(false)
const targetDir = ref('')
const targetStatus = ref(null)
const installStage = ref('')
const installProgress = ref(null)
const installMode = ref('install')

const distributions = computed(() => app.state.launcher?.distributions || [])
const distribution = computed(() => distributions.value.find(item => String(item.distribution_id) === String(distributionId.value)) || distributions.value[0] || null)
const installations = computed(() => app.state.launcher?.game?.installations || [])
const installation = computed(() => installations.value.find(item => item.installation_id === installationId.value) || installations.value[0] || null)
const installed = computed(() => Boolean(installation.value?.installed))
const platformType = computed(() => app.state.launcher?.platform_type || 'fever')
const installRequirements = computed(() => distribution.value?.install_requirements || {})
const sharedLauncher = computed(() => distributions.value.map(item => item.launcher || {}).find(item => item.background_image || item.main_image || item.logo || item.display_name) || {})
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
const startupTip = computed(() => launcher.value.extend_data?.app_startup_tips || '')
const brandButtonStyle = computed(() => {
  const gradient = String(launcher.value.button_gradient || '')
  const stops = [...gradient.matchAll(/stop:\d+(?:\.\d+)?\s+(#[0-9a-f]{6,8})/gi)].map(match => match[1])
  const background = stops.length > 1 ? `linear-gradient(135deg, ${stops.join(', ')})` : launcher.value.button_color || ''
  return background ? { '--brand-button': background, '--brand-button-text': launcher.value.button_text_color || '#fff' } : {}
})

function formatNewsDate(value) { return value ? new Date(Number(value) * 1000).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : '' }
function openSettings() { toolsOpen.value = false; app.setView('settings') }

watch(distributions, list => {
  const preferred = app.state.launcher?.game?.default_distribution
  if (!list.some(item => String(item.distribution_id) === app.state.distributionId)) app.setDistribution(list.find(item => item.distribution_id === preferred)?.distribution_id ?? list[0]?.distribution_id ?? '')
}, { immediate: true })
watch(installations, list => {
  const preferred = app.state.launcher?.game?.default_installation_id
  installationId.value = list.find(item => item.installation_id === preferred)?.installation_id || list[0]?.installation_id || ''
}, { immediate: true })
watch(() => app.state.launcher, value => {
  const url = new URL(location.href)
  if (value && url.searchParams.has('import_from_fever_now')) {
    url.searchParams.delete('import_from_fever_now'); history.replaceState({}, '', url)
    importFever()
  }
}, { immediate: true })

async function chooseDirectory() {
  const picked = await app.guarded('pick-directory', async () => {
    const pending = await request('/native/pick-directory', { method: 'POST', body: { title: `选择${title.value}安装目录`, default_path: targetDir.value } })
    return resolveTask(pending, '/native/task-status')
  }, { optional: true })
  if (!picked || picked.cancelled || !picked.path) return
  targetDir.value = picked.path
  targetStatus.value = await request('/native/path-status', { query: { path: picked.path } })
}
function openInstall() { installMode.value = 'install'; installOpen.value = true }
async function install() {
  if (!targetDir.value) return chooseDirectory()
  installStage.value = '正在检查现有文件…'
  installProgress.value = null
  try {
    await app.guarded('install', async () => {
      const pending = await request('/launcher-install', {
        query: { game_id: app.state.gameId, distribution_id: distributionId.value },
        body: { target_dir: targetDir.value, concurrent: 4 },
      })
      installStage.value = '正在准备下载…'
      const result = pending?.status === 'pending' && pending.task_id
        ? await pollTask('/native/task-status', pending.task_id, {
            onUpdate: status => {
              installProgress.value = status
              installStage.value = status.phase || '正在下载…'
            },
          })
        : pending
      if (result?.success === false) throw new Error(result.error || '启动游戏下载失败')
      await app.refreshCurrent()
      app.notify(result?.download_async ? '游戏下载已在后台开始' : '游戏文件已就绪', 'success')
      installOpen.value = false
      return result
    }, { optional: true })
  } finally { installStage.value = ''; installProgress.value = null }
}
async function locate() {
  const picked = await app.guarded('pick-game', async () => {
    const pending = await request('/native/pick-executable', { method: 'POST', body: { title: `定位${title.value}启动程序` } })
    return resolveTask(pending, '/native/task-status')
  }, { optional: true })
  if (!picked || picked.cancelled || !picked.path) return
  await app.mutate('locate-game', '/launcher-locate', { method: 'POST', body: { game_id: app.state.gameId, path: picked.path } }, { optional: true })
}
async function checkUpdate() {
  updateInfo.value = await app.guarded('update-info', async () => {
    const result = await request('/launcher-update-info', { query: { game_id: app.state.gameId, distribution_id: distributionId.value, installation_id: installationId.value, async: 1 } })
    const resolved = await resolveTask(result, '/native/task-status')
    if (resolved?.success === false) throw new Error(resolved.error || '获取更新信息失败')
    return resolved
  }, { optional: true })
}
async function update() {
  if (!updateInfo.value) await checkUpdate()
  if (!updateInfo.value) return
  if (!updateInfo.value.needs_update) return app.notify('当前游戏文件已是最新', 'success')
  if (updateInfo.value && !confirm(`将下载 ${formatSize(updateInfo.value.download_bytes || 0)}，继续吗？`)) return
  installMode.value = 'update'
  installOpen.value = true
  installStage.value = '正在检查现有文件…'
  installProgress.value = null
  try {
    await app.guarded('update', async () => {
      const pending = await request('/launcher-update', { query: { game_id: app.state.gameId, distribution_id: distributionId.value, installation_id: installationId.value } })
      const result = pending?.status === 'pending' && pending.task_id
        ? await pollTask('/native/task-status', pending.task_id, { onUpdate: status => { installProgress.value = status; installStage.value = status.phase || '正在更新…' } })
        : pending
      if (result?.success === false) throw new Error(result.error || '游戏更新失败')
      await app.refreshCurrent()
      app.notify('游戏更新完成', 'success')
      installOpen.value = false
    }, { optional: true })
  } finally { installStage.value = ''; installProgress.value = null }
}
async function start() { await app.mutate('start', '/start-game', { query: { game_id: app.state.gameId, installation_id: installationId.value } }) }
async function makeDefault() { await app.mutate('default-install', '/launcher-set-default', { query: { game_id: app.state.gameId, installation_id: installationId.value } }) }
async function remove() {
  if (!installation.value || !confirm('删除这条安装记录？不会删除磁盘中的游戏文件。')) return
  await app.mutate('remove-install', '/launcher-remove-installation', { query: { game_id: app.state.gameId, installation_id: installationId.value } })
}
async function importFever() {
  if (app.state.launcher?.game_id !== 'h55' && String(app.state.launcher?.game_id || '').endsWith('h55')) {
    if (!confirm('是否导入已经安装的第五人格新引擎？')) return
    const url = new URL(location.href); url.searchParams.set('game_id', 'h55'); url.searchParams.set('import_from_fever_now', '1'); location.href = url
    return
  }
  const fever = app.state.launcher?.fever || {}
  await app.mutate('fever', '/launcher-import-fever', { query: { game_id: app.state.gameId, distribution_id: fever.distribution_id ?? -1, path: fever.path || '' } })
}
async function importFeverList() {
  const data = await request('/fever-games')
  const item = (data.games || []).find(row => row.game_id === app.state.gameId || row.matched_game_id === app.state.gameId) || data.games?.[0]
  if (!item) return app.notify('没有找到可导入的发烧游戏平台记录', 'warning')
  await app.mutate('fever-list', '/launcher-import-fever', { query: { game_id: item.matched_game_id || item.game_id, distribution_id: item.distribution_id ?? -1, path: item.path || '' } })
}
function toggleNews() { showNews.value = !showNews.value; localStorage.setItem('idv.news.visible', String(showNews.value)) }
function formatSize(bytes) { if (!bytes) return '0 B'; const i = Math.floor(Math.log(bytes) / Math.log(1024)); return `${(bytes / 1024 ** i).toFixed(1)} ${['B','KB','MB','GB','TB'][i]}` }
</script>

<template>
  <section class="launcher-view" :style="hero ? { '--hero': `url(${hero})` } : {}">
    <div class="hero-shade"></div>
    <section class="launcher-identity">
      <img v-if="brandLogo" class="launcher-brand-logo" :src="brandLogo" :alt="title" />
      <h1 v-else>{{ title }}</h1>
      <p>{{ [launcher.developer, launcher.publisher].filter(Boolean).join(' · ') || '网易游戏' }}</p>
      <small v-if="startupTip">{{ startupTip }}</small>
    </section>

    <div class="launcher-bottom">
      <section v-if="showNews" class="news-card glass">
        <img v-if="newsCover" class="news-cover" :src="newsCover" alt="" />
        <header><div><Newspaper :size="18" /> 新闻</div><button class="ghost compact" @click="toggleNews">隐藏</button></header>
        <template v-if="news.length"><a v-for="item in news.slice(0, 3)" :key="item.id || item.url || item.title" href="#" @click.prevent="openExternal(item.url)"><span>{{ item.title }}</span><time>{{ formatNewsDate(item.release_time) }}</time></a><button v-if="newsMoreUrl" class="news-more" @click="openExternal(newsMoreUrl)">查看更多</button></template>
        <p v-else class="muted">当前游戏暂无新闻。可在设置中隐藏此面板。</p>
      </section>
      <button v-else class="ghost show-news" @click="toggleNews"><Newspaper :size="17" /> 显示新闻</button>

      <div class="launcher-controls">
        <label v-if="installation || installations.length" class="installation-picker glass"><span>游戏位置</span><select v-model="installationId"><option value="">暂无安装</option><option v-for="item in installations" :key="item.installation_id" :value="item.installation_id">{{ item.path || item.installation_id }}</option></select></label>
        <div class="launch-actions glass" :style="brandButtonStyle">
          <button v-if="!installed && platformType === 'fever'" class="primary large" :disabled="!distribution?.can_download || Boolean(app.state.busy)" @click="openInstall"><Download /> 下载游戏</button>
          <button v-else-if="!installed" class="primary large" :disabled="Boolean(app.state.busy)" @click="locate"><FolderOpen /> 定位游戏</button>
          <button v-else class="primary large" :disabled="Boolean(app.state.busy)" @click="start"><Play /> 开始游戏</button>
          <button class="icon-button" title="更多设置" @click="toolsOpen = !toolsOpen"><Settings /></button>
        </div>
        <button v-if="!installed && platformType === 'fever'" class="locate-existing" @click="locate"><FolderOpen :size="15" /> 已有游戏？定位启动程序</button>
        <div v-if="toolsOpen" class="launcher-menu glass">
          <button :disabled="!installed || Boolean(app.state.busy)" @click="update">检查游戏更新</button>
          <button :disabled="!installed" @click="makeDefault">设为默认安装</button>
          <button :disabled="!installed" @click="remove">移除安装记录</button>
          <button v-if="app.state.launcher?.can_import_fever" @click="importFever">导入发烧平台安装</button>
          <button @click="importFeverList">从发烧平台列表导入</button>
          <button @click="openSettings">启动与工具设置</button>
        </div>
      </div>
    </div>

    <div v-if="installOpen" class="modal-backdrop" @click.self="installOpen = false">
      <section class="modal install-modal">
        <header><div><small>{{ installMode === 'update' ? '游戏更新' : '游戏下载' }}</small><h2>{{ installMode === 'update' ? '更新' : '安装' }} {{ title }}</h2></div><button class="icon-button" title="关闭" @click="installOpen = false"><X :size="20" /></button></header>
        <div class="modal-body install-body">
          <div class="install-summary"><HardDrive :size="26" /><div><strong>{{ installMode === 'update' ? '更新现有游戏文件' : '选择游戏安装目录' }}</strong><p>需要下载约 {{ formatSize(installMode === 'update' ? (updateInfo?.download_bytes || 0) : (installRequirements.download_bytes || 0)) }}<template v-if="installMode === 'install'">，共 {{ installRequirements.file_count || 0 }} 个文件</template>。</p></div></div>
          <template v-if="installMode === 'install'"><label class="field"><span>安装位置</span><div class="path-row"><input v-model="targetDir" readonly placeholder="请选择一个可写目录" /><button class="ghost" :disabled="Boolean(app.state.busy)" @click="chooseDirectory">浏览</button></div></label><p v-if="targetStatus" class="disk-hint" :class="{ danger: targetStatus.disk_free_bytes < (installRequirements.download_bytes || 0) }">磁盘可用 {{ formatSize(targetStatus.disk_free_bytes) }}<template v-if="targetStatus.disk_free_bytes < (installRequirements.download_bytes || 0)">，空间可能不足</template></p></template>
          <div v-if="installStage" class="download-progress"><div><span>{{ installStage }}</span><strong>{{ Math.round(installProgress?.progress_percent || 0) }}%</strong></div><progress :value="installProgress?.progress_percent || 0" max="100"></progress><small v-if="installProgress?.rate">{{ installProgress.rate }}</small></div>
        </div>
        <footer v-if="installMode === 'install'"><button class="ghost" @click="installOpen = false">取消</button><button class="primary" :disabled="!targetDir || Boolean(app.state.busy)" @click="install"><Download :size="17" /> 开始下载</button></footer>
      </section>
    </div>
  </section>
</template>
