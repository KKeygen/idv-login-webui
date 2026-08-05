<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { Download, FileText, FolderOpen, Link, Save, Trash2 } from '@lucide/vue'
import { ApiError, request, resourceUrl } from '../api'
import { cmpGameId, useAppStore } from '../composables/useAppStore'
import ModalShell from './ModalShell.vue'
import MotionProgressRing from './MotionProgressRing.vue'

const props = defineProps({ open: Boolean, title: { type: String, default: '游戏' } })
const emit = defineEmits(['close', 'update', 'locate', 'remove', 'import-fever', 'import-fever-list'])
const app = useAppStore()
const activeSection = ref('basic')
const loading = ref(false)
const supported = reactive({ autoStart: true, autoClose: true, loginDelay: true, feverBridge: true })
const form = reactive({ autoStart: false, autoClose: false, loginDelay: 0, feverForced: false, feverForceSupported: false })
const sections = [
  { id: 'basic', label: '基本信息' },
  { id: 'launch', label: '启动设置' },
]

const distributions = computed(() => app.state.launcher?.distributions || [])
const distribution = computed(() => distributions.value.find(
  item => String(item.distribution_id) === String(app.state.distributionId)
) || distributions.value[0] || null)
const installation = computed(() => distribution.value?.installation || null)
const installationId = computed(() => installation.value?.installation_id || '')
const distributionId = computed(() => distribution.value?.distribution_id ?? -1)
const installed = computed(() => Boolean(installation.value?.installed))
const canImportFever = computed(() => Boolean(distribution.value?.can_import_fever))
const needsUpdate = computed(() => Boolean(distribution.value?.needs_update))
const gameIcon = computed(() => resourceUrl(
  distribution.value?.launcher?.icon
  || distribution.value?.launcher?.logo
  || app.currentGame.value?.launcher?.icon
  || app.currentGame.value?.icon
  || ''
))
const canUseFeverBridge = computed(() => (
  app.state.launcher?.platform_type === 'fever'
  && installed.value
  && Number(distributionId.value) !== -1
))

function captureScope() {
  return {
    gameId: app.state.gameId,
    distributionId: distributionId.value,
    installationId: installationId.value,
  }
}
function scopeMatches(scope) {
  return Boolean(
    props.open
    && cmpGameId(scope.gameId, app.state.gameId)
    && String(scope.distributionId) === String(distributionId.value)
    && String(scope.installationId) === String(installationId.value),
  )
}
function scopeQuery(scope, extra = {}) {
  return {
    game_id: scope.gameId,
    distribution_id: scope.distributionId,
    installation_id: scope.installationId,
    ...extra,
  }
}
function resetForm() {
  form.autoStart = false
  form.autoClose = false
  form.loginDelay = 0
  form.feverForced = false
  form.feverForceSupported = false
}
async function optional(path, options, key) {
  try { return await request(path, options) }
  catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      supported[key] = false
      app.markUpdateRequired()
      return null
    }
    throw error
  }
}
let loadGeneration = 0
async function load() {
  const generation = ++loadGeneration
  const scope = captureScope()
  if (!scope.installationId) {
    loading.value = false
    resetForm()
    return
  }
  loading.value = true
  resetForm()
  const query = scopeQuery(scope)
  try {
    const [start, close, delay, bridge] = await Promise.allSettled([
      optional('/get-game-auto-start', { query }, 'autoStart'),
      optional('/get-auto-close-state', { query }, 'autoClose'),
      optional('/get-login-delay', { query }, 'loginDelay'),
      optional('/fever-bridge', { query }, 'feverBridge'),
    ])
    if (generation !== loadGeneration || !scopeMatches(scope)) return
    if (start.status === 'fulfilled' && start.value && 'enabled' in start.value) form.autoStart = Boolean(start.value.enabled)
    if (close.status === 'fulfilled' && close.value && 'state' in close.value) form.autoClose = Boolean(close.value.state)
    if (delay.status === 'fulfilled' && delay.value && 'delay' in delay.value) form.loginDelay = Number(delay.value.delay) || 0
    if (bridge.status === 'fulfilled' && bridge.value) {
      form.feverForceSupported = Boolean(bridge.value.configurable)
      form.feverForced = Boolean(bridge.value.forced)
    }
  } finally {
    if (generation === loadGeneration) loading.value = false
  }
}
watch(
  [() => props.open, () => app.state.gameId, distributionId, installationId],
  ([open]) => {
    loadGeneration += 1
    if (!open) {
      loading.value = false
      return
    }
    activeSection.value = 'basic'
    load()
  },
  { immediate: true },
)

async function setAutoStart() {
  const scope = captureScope()
  const enabled = !form.autoStart
  const data = await request('/set-game-auto-start', {
    query: scopeQuery(scope, { enabled, update_mode: 'status_only' }),
  })
  if (data.success === false) throw new Error(data.error || '设置失败')
  if (scopeMatches(scope)) form.autoStart = Boolean(data.enabled)
  app.notify('当前游戏的自动启动设置已保存', 'success')
}
async function toggleAutoClose() {
  const scope = captureScope()
  const data = await request('/switch-auto-close-state', { query: scopeQuery(scope) })
  if (data.success === false) throw new Error(data.error || '设置失败')
  if (scopeMatches(scope)) form.autoClose = Boolean(data.state)
  app.notify('当前游戏的关闭设置已保存', 'success')
}
async function saveDelay() {
  const scope = captureScope()
  const delay = Math.max(0, Number(form.loginDelay) || 0)
  const data = await request('/set-login-delay', {
    query: scopeQuery(scope, { delay }),
  })
  if (data.success === false) throw new Error(data.error || '设置失败')
  app.notify('当前游戏的登录延迟已保存', 'success')
}
async function toggleFeverForced() {
  const scope = captureScope()
  const forced = !form.feverForced
  const data = await request('/fever-bridge', {
    method: 'POST',
    body: {
      forced,
      game_id: scope.gameId,
      distribution_id: scope.distributionId,
    },
  })
  if (data.success === false) throw new Error(data.error || '设置失败')
  if (scopeMatches(scope)) form.feverForced = Boolean(data.forced)
  app.notify('当前游戏的平台托管设置已保存', 'success')
}
async function createShortcut() {
  const scope = captureScope()
  await app.mutate('shortcut', '/create-game-shortcut', {
    method: 'POST', body: scopeQuery(scope),
  }, { reload: false, optional: true })
}
</script>

<template>
  <ModalShell :open="open" :title="`${title} · 游戏设置`" headerless modal-class="game-settings-modal" @close="emit('close')">
    <div class="game-settings-layout">
      <nav class="game-settings-nav">
        <p>游戏设置</p>
        <button v-for="section in sections" v-show="section.id === 'basic' || installed" :key="section.id" :class="{ active: activeSection === section.id }" @click="activeSection = section.id">
          {{ section.label }}
        </button>
      </nav>

      <Transition name="section-change" mode="out-in">
        <section v-if="activeSection === 'basic'" key="basic" class="game-settings-content">
        <div class="game-settings-game-header">
          <span class="game-settings-game-icon">
            <img v-if="gameIcon" :src="gameIcon" alt="" />
            <span v-else>{{ title.slice(0, 1) }}</span>
          </span>
          <div><h2>{{ title }}</h2><p>{{ installed ? (needsUpdate ? '已有可用更新' : '游戏已安装') : '尚未安装' }}</p></div>
          <button v-if="installed" class="quiet-button danger" @click="emit('remove')"><Trash2 :size="15" />移除记录</button>
        </div>

        <div class="game-settings-path-row">
          <FolderOpen :size="16" />
          <span :title="installation?.path">{{ installation?.path || '尚未选择游戏路径' }}</span>
          <button class="quiet-button" @click="emit('locate')">{{ installed ? '重新定位' : '选择路径' }}</button>
        </div>

        <div class="game-settings-actions">
          <button v-if="installed && distribution?.can_update" class="quiet-button accent" @click="emit('update')"><Download :size="15" />{{ needsUpdate ? '更新游戏' : '修复游戏' }}</button>
          <button v-if="installed" class="quiet-button" @click="createShortcut"><Link :size="15" />创建桌面快捷方式</button>
          <button v-if="canImportFever" class="quiet-button" @click="emit('import-fever')"><Download :size="15" />从发烧平台导入</button>
          <button class="quiet-button" @click="emit('import-fever-list')"><FileText :size="15" />从发烧平台列表导入</button>
        </div>
        </section>

        <section v-else key="launch" class="game-settings-content">
          <header><h2>启动设置</h2><p>这些选项只应用于当前游戏。</p></header>
          <div v-if="loading" class="content-loading"><MotionProgressRing :size="28" aria-label="正在读取游戏设置" /><span>正在读取设置…</span></div>
        <template v-else>
          <label v-if="supported.autoStart" class="setting-row"><span><strong>工具启动后自动运行此游戏</strong><small>{{ installation?.path || '尚未选择游戏路径' }}</small></span><input type="checkbox" :checked="form.autoStart" @change="setAutoStart" /></label>
          <label v-if="supported.autoClose" class="setting-row"><span><strong>登录成功后自动关闭工具</strong><small>只应用于当前游戏</small></span><input type="checkbox" :checked="form.autoClose" @change="toggleAutoClose" /></label>
          <label v-if="supported.loginDelay" class="field"><span>自动登录延迟（秒）</span><div class="inline"><input v-model.number="form.loginDelay" type="number" min="0" /><button class="ghost" @click="saveDelay"><Save :size="16" />保存</button></div></label>
          <label v-if="supported.feverBridge && form.feverForceSupported && canUseFeverBridge" class="setting-row"><span><strong>强制此游戏使用平台托管登录</strong><small>覆写当前游戏的默认登录方式判断</small></span><input type="checkbox" :checked="form.feverForced" @change="toggleFeverForced" /></label>
          </template>
        </section>
      </Transition>
    </div>
  </ModalShell>
</template>
