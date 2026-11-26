<script>
import { ref } from 'vue'

// Settings sections unmount during navigation. Keep the task visible on return.
const snapshot = ref(null)
const loading = ref(false)
const applying = ref(false)
const restarting = ref(false)
const taskId = ref('')
const taskResults = ref([])
const error = ref('')
const notice = ref(null)
</script>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { PackageCheck, RotateCw } from '@lucide/vue'
import { ApiError, pollTask, request } from '../api'
import MotionProgressRing from './MotionProgressRing.vue'
import WinExpander from './WinExpander.vue'
import WinInfoBar from './WinInfoBar.vue'

const expandedId = ref('')
const statusLabels = {
  pending: '待应用',
  applied: '已应用',
  restart_required: '待重启',
  pending_validation: '待验证',
  skipped: '已跳过',
  blocked: '已阻止',
  superseded: '已被替代',
}
const entries = computed(() => snapshot.value?.items || [])
const groups = computed(() => [
  { title: '可应用的热更新', entries: entries.value.filter(item => item.applyable) },
  { title: '其他热更新记录', entries: entries.value.filter(item => !item.applyable) },
].filter(group => group.entries.length))
const availableCount = computed(() => snapshot.value?.applyable_count || 0)
const restartRequired = computed(() => snapshot.value?.restart_required === true)
const busy = computed(() => loading.value || applying.value || restarting.value)
const canApply = computed(() => Boolean(snapshot.value?.available && availableCount.value && !busy.value
  && !taskId.value && !error.value))
const resultById = computed(() => new Map(taskResults.value.map(result => [result.id, result])))

async function loadSnapshot() {
  const data = await request('/hotfix-status')
  if (data?.success !== true || typeof data.version !== 'string' || typeof data.available !== 'boolean'
    || !Array.isArray(data.items) || !Number.isInteger(data.applyable_count)) {
    throw new Error('未能读取当前版本的热更新状态')
  }
  snapshot.value = data
  if (!data.restart_required && notice.value?.restarting) notice.value = null
}

async function followApply() {
  const result = await pollTask('/native/task-status', taskId.value)
  if (result?.status !== 'done' || !Array.isArray(result.results)) {
    throw new Error('未确认热更新任务结果')
  }
  taskResults.value = result.results
  taskId.value = ''
  const installed = result.results.filter(item => item.status === 'applied').length
  const failed = result.results.filter(item => item.status === 'failed').length
  const skipped = result.results.filter(item => item.status === 'skipped').length
  const summary = [
    installed ? `已写入 ${installed} 项` : '',
    failed ? `${failed} 项失败` : '',
    skipped ? `${skipped} 项已跳过` : '',
  ].filter(Boolean).join('，')
  notice.value = {
    tone: result.success === true && !failed ? 'success' : 'warning',
    text: summary || result.error || '本次没有写入更新。',
  }
  if (result.restart_required && snapshot.value) snapshot.value = { ...snapshot.value, restart_required: true }
}

async function readStatus() {
  if (busy.value) return
  error.value = ''
  loading.value = true
  try {
    if (taskId.value) {
      applying.value = true
      await followApply()
    }
    await loadSnapshot()
  } catch (failure) {
    error.value = failure instanceof ApiError && failure.status === 404 && !taskId.value
      ? '当前工具版本不支持在此查看热更新。'
      : taskId.value ? '更新任务可能仍在运行。请重新读取状态。'
        : '无法读取热更新状态。请确认工具已启动并重新读取。'
  } finally {
    loading.value = false
    applying.value = false
  }
}

async function applyPending() {
  if (!canApply.value) return
  applying.value = true
  taskResults.value = []
  notice.value = null
  try {
    const result = await request('/hotfix-apply', { method: 'POST', body: {} })
    if (result?.success !== true || !result.task_id) throw new Error('未确认热更新任务已开始')
    taskId.value = result.task_id
    await followApply()
    await loadSnapshot()
  } catch (failure) {
    if (taskId.value) error.value = '更新任务可能仍在运行。请重新读取状态。'
    else if (notice.value) error.value = '已收到更新结果，但无法读取最新状态。请重新读取。'
    else error.value = failure instanceof ApiError ? failure.message : '无法确认更新是否已开始。请重新读取状态。'
  } finally {
    applying.value = false
  }
}

async function restartTool() {
  if (busy.value || taskId.value || error.value || !restartRequired.value) return
  restarting.value = true
  notice.value = null
  try {
    const result = await request('/restart', { method: 'POST' })
    if (result?.success !== true || result.restarting !== true) throw new Error('未确认重启')
    snapshot.value = null
    notice.value = { tone: 'info', text: '工具正在重启。重新连接后，请读取热更新状态。', restarting: true }
  } catch {
    error.value = '无法确认工具是否正在重启。请确认工具已启动并重新读取状态。'
  } finally {
    restarting.value = false
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
    <WinInfoBar v-if="notice" :closable="false" :severity="notice.tone" :message="notice.text" />
    <WinInfoBar v-if="snapshot && !snapshot.available && !error" :closable="false" severity="warning"
      :message="snapshot.available_reason || '官方热更新清单当前不可用。请检查连接后重新读取。'" />
    <WinInfoBar v-if="restartRequired" :closable="false" severity="warning"
      message="更新已写入。重启工具后将加载更新，随后验证是否生效。"
      :action-label="restarting ? '正在重启…' : '重启工具'" :action-disabled="busy || Boolean(taskId) || Boolean(error)" @action="restartTool" />
    <div v-if="loading && !snapshot" class="content-loading" role="status">
      <MotionProgressRing :size="28" aria-hidden="true" /><span>正在读取热更新状态…</span>
    </div>
    <template v-else-if="snapshot">
      <div v-if="snapshot.available" class="setting-row hotfix-apply">
        <span>
          <strong>{{ availableCount ? `${availableCount} 项可应用` : '没有可应用的热更新' }}</strong>
          <small v-if="availableCount">应用后，工具需要重启才能加载更新。</small>
        </span>
        <button v-if="availableCount || applying" :class="restartRequired ? 'quiet-button' : 'primary'" type="button" :disabled="!canApply" @click="applyPending">
          <MotionProgressRing v-if="applying" :size="16" aria-hidden="true" />{{ applying ? '正在应用…' : '应用全部待更新项' }}
        </button>
      </div>
      <div v-for="group in groups" :key="group.title" class="hotfix-group">
        <h3>{{ group.title }}</h3>
        <WinExpander v-for="item in group.entries" :key="item.id" :expanded="expandedId === item.id"
          @update:expanded="open => expandedId = open ? item.id : ''">
          <template #header>
            <span class="hotfix-entry-header">
              <strong :title="item.module">{{ item.module }}</strong>
              <small :data-applyable="item.applyable">{{ statusLabels[item.status] || '状态未知' }}</small>
            </span>
          </template>
          <p>{{ item.note || '此热更新未提供说明。' }}</p>
          <p v-if="item.status === 'pending_validation'" class="hotfix-diagnostic">更新已加载，正常退出并再次启动工具后确认。</p>
          <p v-if="item.message" class="hotfix-diagnostic">{{ item.message }}</p>
          <p v-if="resultById.get(item.id)?.message" :class="{ 'hotfix-error': resultById.get(item.id)?.status === 'failed' }">
            {{ resultById.get(item.id).message }}
          </p>
          <p v-if="item.commit" class="hotfix-commit">
            <span>更新提交</span><code :title="item.commit">{{ item.commit.slice(0, 12) }}</code>
          </p>
        </WinExpander>
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
.hotfix-entry-header small[data-applyable="true"] { color: var(--accent); }
.hotfix-diagnostic { color: var(--muted); }
.hotfix-error { color: #ff99a4; overflow-wrap: anywhere; }
.hotfix-group p { margin: 0; overflow-wrap: anywhere; }
.hotfix-group p + p { margin-top: 8px; }
</style>
