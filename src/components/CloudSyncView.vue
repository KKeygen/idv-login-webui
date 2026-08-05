<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Cloud, KeyRound, Upload, Download, RefreshCw, Trash2, History, Wand2, ShieldCheck, Copy, Save } from '@lucide/vue'
import { ApiError, openExternal, request } from '../api'
import { useAppStore } from '../composables/useAppStore'
import { showConfirm } from '../dialogService'
import ModalShell from './ModalShell.vue'
import HelpTip from './HelpTip.vue'
import MotionProgressRing from './MotionProgressRing.vue'

const app = useAppStore()
const CLOUD_SYNC_POLICY_URL = 'https://www.yuque.com/keygen/kg2r5k/pvb2mdma2zpq442g'
const policy = ref(null)
const supported = ref(true)
const accounts = ref([])
const selectedUuids = ref([])
const logs = ref([])
const logsOpen = ref(false)
const wizardOpen = ref(false)
const wizardStep = ref(1)
const wizardMode = ref('import_existing')
const wizardRunNow = ref(true)
const probeResult = ref(null)
const working = ref('')
let probeGeneration = 0
const form = reactive({ consent_ack: false, master_key: '', remember_level: 'none', auto_sync: false, sync_direction: 'bidirectional', scope_type: 'all', scope_game_id: '', expire_time: 259200 })

const strength = computed(() => evaluateStrength(form.master_key))
const syncDirectionLabel = computed(() => ({
  pull: '云端 → 本地',
  push: '本地 → 云端',
  bidirectional: '双向同步',
})[form.sync_direction] || '按设置同步')
function evaluateStrength(value = '') {
  const groups = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(re => re.test(value)).length
  return { valid: value.length >= 12 && groups >= 3, label: !value ? '未输入' : value.length >= 16 && groups >= 4 ? '强' : value.length >= 12 && groups >= 3 ? '合格' : '不足' }
}
function payload(extra = {}) { return { ...form, scope_game_id: form.scope_type === 'current_game' ? app.state.gameId : '', scope_uuids: form.scope_type === 'selected' ? selectedUuids.value : [], ...extra } }
async function load() {
  const [settingsData, policyData, accountsData] = await Promise.all([request('/cloud-sync/settings'), request('/cloud-sync/policy'), request('/cloud-sync/accounts')])
  const data = settingsData.settings || {}
  for (const key of Object.keys(form)) if (key in data) form[key] = data[key]
  if (data.saved_master_key) form.master_key = data.saved_master_key
  if (Array.isArray(data.scope_uuids)) selectedUuids.value = data.scope_uuids
  policy.value = policyData.policy || null
  accounts.value = accountsData.accounts || []
  if (form.auto_sync) await run('auto', true)
}
async function save(silent = false) {
  if (working.value) return null
  if (form.master_key && !strength.value.valid) throw new Error('主密钥至少 12 位并包含三类字符')
  working.value = 'save'
  try {
    const data = await request('/cloud-sync/settings', { method: 'POST', body: payload() })
    if (!data.success) throw new Error(data.error || '保存失败')
    if (!silent) app.notify('云同步设置已保存', 'success')
    return data
  } finally {
    if (working.value === 'save') working.value = ''
  }
}
async function run(action, silent = false) {
  if (working.value) return null
  if (!form.consent_ack) return app.notify('请先同意存储与权限说明', 'warning')
  const state = `run-${action}`
  working.value = state
  try {
    const data = await request('/cloud-sync/run', { method: 'POST', body: payload({ action }) })
    if (!data.success) throw new Error(data.error || '同步失败')
    if (!silent) app.notify(data.skipped ? '自动同步当前未启用' : '云同步操作完成', data.skipped ? 'warning' : 'success')
    await app.loadAccounts({ force: true })
    return data
  } finally {
    if (working.value === state) working.value = ''
  }
}
async function removeRemote() {
  const confirmed = await showConfirm('云端密文与同步设置将被删除，本地账号记录不会受到影响。', { title: '删除云端同步', confirmText: '删除云端数据', danger: true })
  if (!confirmed) return
  const data = await request('/cloud-sync/delete', { method: 'POST', body: { master_key: form.master_key } })
  if (!data.success) throw new Error(data.error || '删除失败')
  form.auto_sync = false; form.remember_level = 'none'; form.consent_ack = false
  app.notify('云端同步已删除', 'success')
}
async function viewLogs() { const data = await request('/cloud-sync/access-logs', { method: 'POST', body: { master_key: form.master_key } }); if (!data.success) throw new Error(data.error); logs.value = data.logs || []; logsOpen.value = true }
async function generateKey() {
  if (working.value) return
  const data = await request('/cloud-sync/generate-master-key', { method: 'POST', body: { length: 16 } })
  if (data.success) { form.master_key = data.master_key; probeResult.value = null }
}
async function copyKey() { await navigator.clipboard.writeText(form.master_key); app.notify('主密钥已复制', 'success') }
function downloadKey() { const blob = new Blob([`IdentityV Login Helper Cloud Sync\nmaster_key=${form.master_key}\n`], { type: 'text/plain;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `idv-cloud-master-key-${new Date().toISOString().slice(0,10)}.txt`; a.click(); URL.revokeObjectURL(a.href) }
function importKey(event) {
  if (working.value) return
  const file = event.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    if (working.value) return
    const raw = String(reader.result || '')
    form.master_key = (raw.match(/master_key\s*=\s*([^\r\n]+)/i)?.[1] || raw).trim()
    probeResult.value = null
  }
  reader.readAsText(file, 'utf-8')
}
function openWizard() {
  probeGeneration += 1
  wizardStep.value = 1
  wizardMode.value = 'import_existing'
  wizardRunNow.value = true
  probeResult.value = null
  wizardOpen.value = true
}
function closeWizard() {
  if (working.value) return
  probeGeneration += 1
  wizardOpen.value = false
}
async function wizardNext() {
  if (working.value) return
  if (wizardStep.value === 1 && !form.consent_ack) return app.notify('请先阅读并同意存储与权限说明', 'warning')
  if (wizardStep.value === 2) {
    if (!strength.value.valid) return app.notify('请输入符合强度要求的主密钥', 'warning')
    if (wizardMode.value === 'import_existing') {
      const generation = ++probeGeneration
      const masterKey = form.master_key
      const mode = wizardMode.value
      working.value = 'probe'
      let result
      try {
        result = await request('/cloud-sync/probe', { method: 'POST', body: { master_key: masterKey } })
      } finally {
        if (working.value === 'probe') working.value = ''
      }
      if (
        generation !== probeGeneration
        || !wizardOpen.value
        || wizardStep.value !== 2
        || wizardMode.value !== mode
        || form.master_key !== masterKey
      ) return
      probeResult.value = result
      if (!result.success || !result.exists) return app.notify(result.message || result.error || '未找到已有同步', 'warning')
      form.sync_direction = 'pull'
    }
  }
  wizardStep.value += 1
}
async function wizardFinish() {
  if (working.value) return
  await save(true)
  wizardOpen.value = false
  probeGeneration += 1
  app.notify('云同步配置完成', 'success')
  if (wizardRunNow.value) await run('sync')
}
onMounted(async () => { try { await load() } catch (error) { if (error instanceof ApiError && error.status === 404) { supported.value = false; app.markUpdateRequired() } else app.notify(error.message || '云同步设置加载失败', 'error') } })
</script>

<template>
  <section class="content-page cloud-page">
    <header class="page-title"><div><p class="eyebrow">端到端加密</p><h1>云同步</h1><p>云端只保存密文，主密钥由你保管。</p></div><button class="primary" @click="openWizard"><Wand2 :size="18" /> 配置向导</button></header>
    <div v-if="!supported" class="empty-state"><Cloud :size="38" /><h2>当前工具版本暂不支持云同步</h2><p>更新工具后即可在这里配置；账号管理和游戏启动仍可正常使用。</p></div>
    <div v-else class="cloud-layout">
      <article class="settings-card cloud-main">
        <header><KeyRound :size="20" /><div><h2>凭证与范围</h2><p>云端只接收加密后的账号记录，主密钥由你自己保管。</p></div></header>
        <p class="cloud-policy-note">主密钥同时用于派生云端记录地址、访问凭证和加密密钥。它不会上传；丢失后无法恢复云端内容，获得它的人则可以读取、修改或删除该记录。</p>
        <label class="field"><span class="field-label-with-help">主密钥 <HelpTip text="至少 12 位并包含小写字母、大写字母、数字、符号中的三类。创建新同步时请另存一份；导入已有同步时必须使用当时的同一主密钥。" /></span><div class="inline"><input v-model="form.master_key" type="password" autocomplete="off" placeholder="至少 12 位并包含三类字符" /><button class="icon-button" title="复制" @click="copyKey"><Copy :size="17" /></button></div><small :class="strength.valid ? 'success-text' : 'muted'">强度：{{ strength.label }}</small></label>
        <div class="two-fields"><label class="field"><span class="field-label-with-help">记住主密钥 <HelpTip text="选择‘不记住’时，后端不会持久化主密钥，重启工具后需重新输入；选择‘在本地记住’后才能在启动时自动同步。" /></span><select v-model="form.remember_level"><option value="none">不记住</option><option value="master_key">在本地记住</option></select></label><label class="field"><span class="field-label-with-help">同步方向 <HelpTip text="云端→本地会把云端账号合并到本地，同 UUID 保留最新登录记录；本地→云端会用当前选定范围重写云端密文；双向同步先拉取合并，再上传合并后的结果。" /></span><select v-model="form.sync_direction"><option value="pull">云端 → 本地</option><option value="push">本地 → 云端</option><option value="bidirectional">双向同步</option></select></label></div>
        <div class="two-fields"><label class="field"><span class="field-label-with-help">账号范围 <HelpTip text="此范围只限制上传到云端的本地账号：可选所有账号、当前游戏的账号，或手动指定 UUID。下载时依然会合并该云端记录中已有的内容。" /></span><select v-model="form.scope_type"><option value="all">所有账号</option><option value="current_game">当前游戏</option><option value="selected">指定账号</option></select></label><label class="field"><span class="field-label-with-help">保留时间 <HelpTip text="每次上传或双向同步会使用这个期限创建或续期云端记录。超过期限后云端服务可能自动删除密文，本地账号不受影响。" /></span><select v-model.number="form.expire_time"><option :value="3600">1 小时</option><option :value="21600">6 小时</option><option :value="86400">1 天</option><option :value="259200">3 天</option><option :value="604800">1 周</option><option :value="2592000">1 个月</option><option :value="7776000">3 个月</option><option :value="15552000">半年</option><option :value="31536000">1 年</option><option :value="63072000">2 年</option><option :value="94608000">3 年</option></select></label></div>
        <div v-if="form.scope_type === 'selected'" class="scope-list"><label v-for="account in accounts" :key="account.uuid"><input v-model="selectedUuids" type="checkbox" :value="account.uuid" /> {{ account.name || account.uuid }} <small>{{ account.game_id }}</small></label></div>
        <label class="setting-row"><span><strong class="setting-title-with-help">启用自动同步 <HelpTip text="启动工具时按所选同步方向执行一次；本地账号记录变化后，等待 5 秒再自动上传当前账号范围。此功能需要同意说明并在本地记住主密钥。" /></strong><small>账号记录变化后自动上传，启动时按方向同步</small></span><input v-model="form.auto_sync" type="checkbox" /></label>
        <label class="consent"><input v-model="form.consent_ack" type="checkbox" /><span>我已阅读并同意 <a :href="CLOUD_SYNC_POLICY_URL" target="_blank" rel="noopener noreferrer" class="policy-link" @click.stop.prevent="openExternal(CLOUD_SYNC_POLICY_URL)">云同步详细说明和隐私政策</a></span></label>
        <button class="primary wide" :disabled="Boolean(working)" @click="save()"><MotionProgressRing v-if="working === 'save'" :size="17" aria-label="正在保存云同步设置" /><Save v-else :size="17" />{{ working === 'save' ? '正在保存…' : '保存设置' }}</button>
      </article>
      <aside class="cloud-actions">
        <button :disabled="Boolean(working)" @click="run('push')"><MotionProgressRing v-if="working === 'run-push'" :size="20" aria-label="正在上传云同步" /><Upload v-else />上传到云端<small>使用当前账号范围</small></button><button :disabled="Boolean(working)" @click="run('pull')"><MotionProgressRing v-if="working === 'run-pull'" :size="20" aria-label="正在下载云同步" /><Download v-else />下载到本地<small>合并云端账号记录</small></button><button :disabled="Boolean(working)" @click="run('sync')"><MotionProgressRing v-if="working === 'run-sync'" :size="20" aria-label="正在执行双向同步" /><RefreshCw v-else />按方向同步<small>{{ syncDirectionLabel }}</small></button><button :disabled="Boolean(working)" @click="viewLogs"><History />查看访问日志</button><button class="danger" :disabled="Boolean(working)" @click="removeRemote"><Trash2 />删除云端同步</button>
      </aside>
    </div>

    <ModalShell :open="wizardOpen" title="云同步配置向导" :dismissible="!working" @close="closeWizard">
      <div class="wizard-progress"><span v-for="n in 4" :key="n" :class="{ active: n <= wizardStep }"></span></div>
      <Transition name="wizard-step" mode="out-in">
      <div v-if="wizardStep === 1" :key="1" class="wizard-step"><ShieldCheck :size="48" /><h3>先了解数据如何保存</h3><div class="wizard-explanation"><p>{{ policy?.storage || '云端仅保存加密后的账号记录，主密钥不会上传。' }}</p><p>主密钥是访问、解密、修改和删除云端记录的唯一凭证。工具和云端都无法在丢失后帮你恢复它。</p></div><label class="consent"><input v-model="form.consent_ack" type="checkbox" /><span>我已阅读并理解 <a :href="CLOUD_SYNC_POLICY_URL" target="_blank" rel="noopener noreferrer" class="policy-link" @click.stop.prevent="openExternal(CLOUD_SYNC_POLICY_URL)">云同步详细说明和隐私政策</a></span></label><label class="field"><span>使用场景</span><select v-model="wizardMode"><option value="import_existing">导入已有同步</option><option value="create_new">创建新的同步</option></select><small>导入时会校验云端记录；创建时将在首次上传后生成新记录。</small></label></div>
      <div v-else-if="wizardStep === 2" :key="2" class="wizard-step"><KeyRound :size="48" /><h3>设置主密钥</h3><p class="wizard-lead">{{ wizardMode === 'import_existing' ? '输入创建该云端记录时使用的主密钥，下一步会检查它是否对应有效数据。' : '生成或输入一个新主密钥，并立即在安全位置保存副本。' }}</p><div class="inline"><input v-model="form.master_key" :disabled="Boolean(working)" placeholder="粘贴或生成主密钥" @input="probeResult = null" /><button class="primary" :disabled="Boolean(working)" @click="generateKey">生成</button></div><p>密钥强度：{{ strength.label }}（至少 12 位且包含三类字符）</p><div class="inline"><button class="ghost" :disabled="Boolean(working)" @click="downloadKey">保存为文本</button><label class="ghost file-button" :class="{ disabled: Boolean(working) }">从文本导入<input type="file" accept=".txt,text/plain" :disabled="Boolean(working)" @change="importKey" /></label></div><p v-if="probeResult" class="muted">{{ probeResult.exists ? `找到约 ${probeResult.remote_channels_count || 0} 个云端账号` : probeResult.message }}</p></div>
      <div v-else-if="wizardStep === 3" :key="3" class="wizard-step"><Cloud :size="48" /><h3>同步选项</h3><p class="wizard-lead">账号范围只限制上传内容。双向同步会先下载并合并同 UUID 的最新记录，再上传合并结果。</p><label class="field"><span>账号范围</span><select v-model="form.scope_type"><option value="all">所有账号</option><option value="current_game">当前游戏</option><option value="selected">指定账号</option></select></label><label class="field"><span>同步方向</span><select v-model="form.sync_direction"><option value="pull">云端 → 本地</option><option value="push">本地 → 云端</option><option value="bidirectional">双向同步</option></select></label><label class="setting-row"><span><strong>自动同步</strong><small>需要在本地记住主密钥；启动时同步，账号变化 5 秒后上传。</small></span><input v-model="form.auto_sync" type="checkbox" /></label></div>
      <div v-else :key="4" class="wizard-step"><ShieldCheck :size="48" /><h3>准备就绪</h3><p>请确认已经在安全位置保存主密钥。丢失后无法恢复云端数据。</p><label class="consent"><input v-model="wizardRunNow" type="checkbox" />完成后立即执行一次同步</label></div>
      </Transition>
      <template #footer><button v-if="wizardStep > 1" class="ghost" :disabled="Boolean(working)" @click="wizardStep--">上一步</button><button v-if="wizardStep < 4" class="primary" :disabled="Boolean(working)" @click="wizardNext"><MotionProgressRing v-if="working === 'probe'" :size="16" aria-label="正在校验云同步" />{{ working === 'probe' ? '正在校验…' : '下一步' }}</button><button v-else class="primary" :disabled="Boolean(working)" @click="wizardFinish"><MotionProgressRing v-if="working" :size="16" aria-label="正在完成云同步配置" />{{ working ? '正在完成…' : '完成并保存' }}</button></template>
    </ModalShell>
    <ModalShell :open="logsOpen" title="云同步访问日志" @close="logsOpen = false"><div v-if="!logs.length" class="empty-state">暂无访问日志</div><pre v-else class="log-view">{{ JSON.stringify(logs, null, 2) }}</pre></ModalShell>
  </section>
</template>
