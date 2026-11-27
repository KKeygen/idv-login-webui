<script>
import { ref } from 'vue'

// An installation may still finish while another settings section is open.
const installing = ref(false)
const snapshot = ref(null)
const selected = ref([])
const error = ref('')
const notice = ref('')
</script>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { PackageCheck, RotateCw } from '@lucide/vue'
import { ApiError, pollTask, request } from '../api'
import { useAppStore } from '../composables/useAppStore'
import { supportsHotfixSettings } from '../featureVersions'
import MotionProgressRing from './MotionProgressRing.vue'
import WinExpander from './WinExpander.vue'
import WinInfoBar from './WinInfoBar.vue'

const app = useAppStore()
const supported = computed(() => supportsHotfixSettings(app.state.backendVersion))
const loading = ref(false)
const expandedId = ref('')
const busy = computed(() => loading.value || installing.value)
const entries = computed(() => snapshot.value?.items || [])
const available = computed(() => entries.value.filter(item => item.applyable))
const installed = item => ['applied', 'pending_validation'].includes(item.status)
const groups = computed(() => [
  { title: '可安装的热更新', entries: available.value },
  { title: '已安装', entries: entries.value.filter(installed) },
  { title: '其他热更新记录', entries: entries.value.filter(item => !item.applyable && !installed(item)) },
].filter(group => group.entries.length))

async function loadSnapshot() {
  const data = await request('/hotfix-status')
  if (data?.success !== true || typeof data.version !== 'string' || typeof data.available !== 'boolean'
    || !Array.isArray(data.items)) {
    throw new Error('未能读取当前版本的热更新')
  }
  snapshot.value = data
  selected.value = data.items.filter(item => item.applyable).map(item => item.id)
  if (data.install_and_restart !== true) {
    notice.value = '当前工具版本仅支持查看热更新。'
  }
}

async function readStatus() {
  if (!supported.value || busy.value) return
  error.value = ''
  notice.value = ''
  loading.value = true
  try {
    await loadSnapshot()
  } catch (failure) {
    error.value = failure instanceof ApiError && failure.status === 404
      ? '当前工具版本不支持在此查看热更新。'
      : '无法读取热更新。请确认工具已启动并重新读取。'
  } finally {
    loading.value = false
  }
}

async function installSelected() {
  if (busy.value || !snapshot.value?.available || !snapshot.value.install_and_restart || !selected.value.length) return
  const ids = [...selected.value]
  installing.value = true
  error.value = ''
  notice.value = ''
  try {
    const started = await request('/hotfix-apply', { method: 'POST', body: { ids } })
    if (started?.success !== true || !started.task_id) throw new Error('未能确认安装已开始')
    const result = await pollTask('/native/task-status', started.task_id)
    if (result?.success !== true || result.restarting !== true) {
      throw new Error(result?.error || '工具未能开始重启')
    }
    snapshot.value = null
    notice.value = '下载和校验完成，工具正在重启。'
  } catch (failure) {
    // A reboot can retire the in-memory task before this browser receives its final poll.
    if (failure instanceof TypeError || failure instanceof ApiError && failure.status === 404) {
      try {
        await loadSnapshot()
        if (ids.every(id => entries.value.some(item => item.id === id && installed(item)))) {
          notice.value = '所选热更新已安装。'
          return
        }
      } catch {
        snapshot.value = null
      }
      notice.value = '连接中断。工具恢复后可重新读取热更新。'
    } else {
      error.value = failure.message || '无法安装热更新。'
    }
  } finally {
    installing.value = false
  }
}

onMounted(readStatus)
</script>

<template>
  <section class="settings-card hotfix-settings" aria-label="工具热更新">
    <div class="hotfix-toolbar">
      <div class="hotfix-version">
        <PackageCheck :size="20" aria-hidden="true" />
        <div>
          <h2>当前安装版本</h2>
          <p>{{ snapshot?.version || '尚未读取' }}</p>
        </div>
      </div>
      <button class="quiet-button" type="button" :disabled="busy" @click="readStatus">
        <RotateCw :size="16" aria-hidden="true" />重新读取
      </button>
    </div>

    <WinInfoBar v-if="error" :closable="false" severity="error" :message="error" />
    <WinInfoBar v-if="notice" :closable="false" severity="info" :message="notice" />
    <WinInfoBar v-if="snapshot && !snapshot.available && !error" :closable="false" severity="warning"
      :message="snapshot.available_reason || '官方热更新清单当前不可用。请检查连接后重新读取。'" />
    <div v-if="loading && !snapshot" class="content-loading" role="status">
      <MotionProgressRing :size="28" aria-hidden="true" /><span>正在读取热更新状态…</span>
    </div>
    <template v-else-if="snapshot">
      <div v-if="snapshot.available && snapshot.install_and_restart && available.length" class="setting-row hotfix-apply">
        <span>
          <strong>已选 {{ selected.length }} 项热更新</strong>
          <small>下载并校验完成后，工具会自动重启。</small>
        </span>
        <button class="primary" type="button" :disabled="busy || !selected.length" @click="installSelected">
          <MotionProgressRing v-if="installing" :size="16" aria-hidden="true" />{{ installing ? '正在下载和校验…' : '安装所选更新' }}
        </button>
      </div>
      <div v-for="group in groups" :key="group.title" class="hotfix-group">
        <h3>{{ group.title }}</h3>
        <div v-for="item in group.entries" :key="item.id" class="hotfix-entry">
          <input v-if="item.applyable && snapshot.install_and_restart" v-model="selected" class="hotfix-selection"
            type="checkbox" :value="item.id" :aria-label="`安装 ${item.module}`" :disabled="busy" />
          <WinExpander :expanded="expandedId === item.id"
            @update:expanded="open => expandedId = open ? item.id : ''">
            <template #header>
              <span class="hotfix-entry-header">
                <strong :title="item.module">{{ item.module }}</strong>
                <small>{{ item.applyable ? '可安装' : installed(item) ? '已安装' : '不可安装' }}</small>
              </span>
            </template>
            <p>{{ item.note || '此热更新未提供说明。' }}</p>
            <p v-if="item.message" class="hotfix-diagnostic">{{ item.message }}</p>
            <p v-if="item.commit" class="hotfix-commit">
              <span>更新提交</span><code :title="item.commit">{{ item.commit.slice(0, 12) }}</code>
            </p>
          </WinExpander>
        </div>
      </div>
      <p v-if="snapshot.available && !entries.length" class="hotfix-empty">当前版本暂无热更新记录。</p>
    </template>
  </section>
</template>

<style scoped>
.hotfix-settings { display: grid; gap: 16px; }
.hotfix-toolbar, .hotfix-version, .hotfix-commit { display: flex; align-items: center; gap: 12px; }
.hotfix-toolbar { justify-content: space-between; flex-wrap: wrap; }
.hotfix-version > svg { flex-shrink: 0; color: var(--accent); }
.hotfix-version h2, .hotfix-group h3 { margin: 0; font-size: 16px; font-weight: 600; }
.hotfix-version p, .hotfix-entry-header small, .hotfix-commit, .hotfix-empty { margin: 0; color: var(--muted); font-size: 12px; }
.hotfix-version p { margin-top: 4px; font-variant-numeric: tabular-nums; }
.hotfix-apply { gap: 12px 16px; flex-wrap: wrap; }
.hotfix-apply button { flex-shrink: 0; }
.hotfix-group { display: grid; gap: 8px; min-width: 0; }
.hotfix-group h3 { margin-bottom: 4px; }
.hotfix-entry-header { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 12px; padding: 10px 0; }
.hotfix-entry-header strong { font-weight: 500; flex: 1 1 200px; min-width: 0; overflow-wrap: anywhere; }
.hotfix-entry { display: flex; gap: 12px; align-items: flex-start; min-width: 0; }
.hotfix-entry > :last-child { flex: 1; min-width: 0; }
.hotfix-selection { margin: 20px 0 0 6px; accent-color: var(--accent); }
.hotfix-diagnostic { color: var(--muted); }
.hotfix-group p { margin: 0; overflow-wrap: anywhere; }
.hotfix-group p + p { margin-top: 8px; }
</style>
