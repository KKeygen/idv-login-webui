<script setup>
import { computed, ref, watch } from 'vue'
import { Download, RefreshCw, Play, FolderOpen, Trash2, Star, Import, Settings, Newspaper } from '@lucide/vue'
import { openExternal, request, resolveTask, resourceUrl } from '../api'
import { useAppStore } from '../composables/useAppStore'

const app = useAppStore()
const distributionId = computed({ get: () => app.state.distributionId, set: value => app.setDistribution(value) })
const installationId = ref('')
const updateInfo = ref(null)
const showNews = ref(localStorage.getItem('idv.news.visible') !== 'false')

const distributions = computed(() => app.state.launcher?.distributions || [])
const distribution = computed(() => distributions.value.find(item => String(item.distribution_id) === String(distributionId.value)) || distributions.value[0] || null)
const installations = computed(() => distribution.value?.installations || app.state.launcher?.game?.installations || [])
const installation = computed(() => installations.value.find(item => item.installation_id === installationId.value) || installations.value[0] || null)
const launcher = computed(() => distribution.value?.launcher || {})
const hero = computed(() => resourceUrl(launcher.value.main_image || ''))
const icon = computed(() => resourceUrl(launcher.value.icon || launcher.value.logo || app.currentGame.value?.icon || ''))
const title = computed(() => launcher.value.display_name || launcher.value.app_name || app.currentGame.value?.display_name || app.currentGame.value?.app_name || '游戏启动器')
const news = computed(() => launcher.value.news || app.currentGame.value?.news || [])

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

async function action(name, path, query, taskPath = '/import-status') {
  await app.mutate(name, path, { query }, { taskPath, optional: true })
}
async function install() { await action('install', '/launcher-install', { game_id: app.state.gameId, distribution_id: distributionId.value }) }
async function checkUpdate() {
  updateInfo.value = await app.guarded('update-info', () => request('/launcher-update-info', { query: { game_id: app.state.gameId, distribution_id: distributionId.value, installation_id: installationId.value } }), { optional: true })
}
async function update() {
  if (!updateInfo.value) await checkUpdate()
  if (updateInfo.value && !confirm(`将下载 ${formatSize(updateInfo.value.download_size || 0)}，继续吗？`)) return
  await action('update', '/launcher-update', { game_id: app.state.gameId, distribution_id: distributionId.value, installation_id: installationId.value })
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
    <div class="distribution-strip" aria-label="游戏分发">
      <button v-for="item in distributions" :key="item.distribution_id" class="distribution-card" :class="{ active: String(item.distribution_id) === String(distributionId) }" @click="distributionId = String(item.distribution_id)">
        <img v-if="resourceUrl(item.launcher?.icon || item.launcher?.logo)" :src="resourceUrl(item.launcher?.icon || item.launcher?.logo)" alt="" />
        <span>{{ item.launcher?.display_name || item.launcher?.app_name || `分发 ${item.distribution_id}` }}</span>
      </button>
    </div>

    <div class="launcher-summary glass">
      <img v-if="icon" class="launcher-icon" :src="icon" alt="" />
      <div><p class="eyebrow">{{ launcher.developer || '网易游戏' }}</p><h1>{{ title }}</h1><p>{{ launcher.publisher || launcher.startup_path || '选择分发并管理本地安装' }}</p></div>
      <div class="summary-controls">
        <label>本地安装<select v-model="installationId"><option value="">暂无安装</option><option v-for="item in installations" :key="item.installation_id" :value="item.installation_id">{{ item.path || item.installation_id }} · {{ item.installed_version || '未知版本' }}</option></select></label>
        <div class="version-row"><span>本地 {{ installation?.installed_version || '未安装' }}</span><span>目标 {{ distribution?.target_version || '未知' }}</span></div>
      </div>
    </div>

    <div class="launcher-bottom">
      <section v-if="showNews" class="news-card glass">
        <header><div><Newspaper :size="18" /> 新闻</div><button class="ghost compact" @click="toggleNews">隐藏</button></header>
        <template v-if="news.length"><a v-for="item in news" :key="item.url || item.title" href="#" @click.prevent="openExternal(item.url)">{{ item.title }}</a></template>
        <p v-else class="muted">当前游戏暂无新闻。可在设置中隐藏此面板。</p>
      </section>
      <button v-else class="ghost show-news" @click="toggleNews"><Newspaper :size="17" /> 显示新闻</button>

      <div class="launch-actions glass">
        <button v-if="!installation" class="primary large" :disabled="!distribution?.can_download || app.state.busy" @click="install"><Download /> 下载游戏</button>
        <button v-else class="primary large" :disabled="app.state.busy" @click="start"><Play /> 开始游戏</button>
        <button class="icon-button" title="检查并更新" :disabled="!installation || app.state.busy" @click="update"><RefreshCw /></button>
        <button class="icon-button" title="设为默认安装" :disabled="!installation" @click="makeDefault"><Star /></button>
        <button class="icon-button" title="移除安装记录" :disabled="!installation" @click="remove"><Trash2 /></button>
        <button v-if="app.state.launcher?.can_import_fever" class="icon-button" title="导入发烧游戏平台记录" @click="importFever"><Import /></button>
        <button class="icon-button" title="从发烧游戏平台列表导入" @click="importFeverList"><FolderOpen /></button>
        <button class="icon-button" title="启动设置" @click="app.setView('settings')"><Settings /></button>
      </div>
    </div>
  </section>
</template>
