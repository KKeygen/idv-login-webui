<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Cloud, KeyRound, Upload, Download, RefreshCw, Trash2, History, Wand2, ShieldCheck, Copy, Save } from '@lucide/vue'
import { ApiError, request } from '../api'
import { useAppStore } from '../composables/useAppStore'
import ModalShell from './ModalShell.vue'

const app = useAppStore()
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
const form = reactive({ consent_ack: false, master_key: '', remember_level: 'none', auto_sync: false, sync_direction: 'bidirectional', scope_type: 'all', scope_game_id: '', expire_time: 259200 })

const strength = computed(() => evaluateStrength(form.master_key))
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
  if (form.master_key && !strength.value.valid) throw new Error('主密钥至少 12 位并包含三类字符')
  const data = await request('/cloud-sync/settings', { method: 'POST', body: payload() })
  if (!data.success) throw new Error(data.error || '保存失败')
  if (!silent) app.notify('云同步设置已保存', 'success')
  return data
}
async function run(action, silent = false) {
  if (!form.consent_ack) return app.notify('请先同意存储与权限说明', 'warning')
  const data = await request('/cloud-sync/run', { method: 'POST', body: payload({ action }) })
  if (!data.success) throw new Error(data.error || '同步失败')
  if (!silent) app.notify(data.skipped ? '自动同步当前未启用' : '云同步操作完成', data.skipped ? 'warning' : 'success')
  await app.loadAccounts()
}
async function removeRemote() {
  if (!confirm('确定删除云端同步？本地记录不会删除。')) return
  const data = await request('/cloud-sync/delete', { method: 'POST', body: { master_key: form.master_key } })
  if (!data.success) throw new Error(data.error || '删除失败')
  form.auto_sync = false; form.remember_level = 'none'; form.consent_ack = false
  app.notify('云端同步已删除', 'success')
}
async function viewLogs() { const data = await request('/cloud-sync/access-logs', { method: 'POST', body: { master_key: form.master_key } }); if (!data.success) throw new Error(data.error); logs.value = data.logs || []; logsOpen.value = true }
async function generateKey() { const data = await request('/cloud-sync/generate-master-key', { method: 'POST', body: { length: 16 } }); if (data.success) form.master_key = data.master_key }
async function copyKey() { await navigator.clipboard.writeText(form.master_key); app.notify('主密钥已复制', 'success') }
function downloadKey() { const blob = new Blob([`IdentityV Login Helper Cloud Sync\nmaster_key=${form.master_key}\n`], { type: 'text/plain;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `idv-cloud-master-key-${new Date().toISOString().slice(0,10)}.txt`; a.click(); URL.revokeObjectURL(a.href) }
function importKey(event) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { const raw = String(reader.result || ''); form.master_key = (raw.match(/master_key\s*=\s*([^\r\n]+)/i)?.[1] || raw).trim() }; reader.readAsText(file, 'utf-8') }
function openWizard() { wizardStep.value = 1; wizardMode.value = 'import_existing'; wizardRunNow.value = true; probeResult.value = null; wizardOpen.value = true }
async function wizardNext() {
  if (wizardStep.value === 1 && !form.consent_ack) return app.notify('请先阅读并同意存储与权限说明', 'warning')
  if (wizardStep.value === 2) {
    if (!strength.value.valid) return app.notify('请输入符合强度要求的主密钥', 'warning')
    if (wizardMode.value === 'import_existing') {
      probeResult.value = await request('/cloud-sync/probe', { method: 'POST', body: { master_key: form.master_key } })
      if (!probeResult.value.success || !probeResult.value.exists) return app.notify(probeResult.value.message || probeResult.value.error || '未找到已有同步', 'warning')
      form.sync_direction = 'pull'
    }
  }
  wizardStep.value = Math.min(4, wizardStep.value + 1)
}
async function wizardFinish() { await save(true); wizardOpen.value = false; app.notify('云同步配置完成', 'success'); if (wizardRunNow.value) await run('sync') }
onMounted(async () => { try { await load() } catch (error) { if (error instanceof ApiError && error.status === 404) { supported.value = false; app.markUpdateRequired() } else app.notify(error.message || '云同步设置加载失败', 'error') } })
</script>

<template>
  <section class="content-page cloud-page">
    <header class="page-title"><div><p class="eyebrow">端到端加密</p><h1>云同步</h1><p>云端只保存密文，主密钥由你保管。</p></div><button class="primary" @click="openWizard"><Wand2 :size="18" /> 配置向导</button></header>
    <div v-if="!supported" class="empty-state"><Cloud :size="38" /><h2>当前工具版本暂不支持云同步</h2><p>更新工具后即可在这里配置；账号管理和游戏启动仍可正常使用。</p></div>
    <div v-else class="cloud-layout">
      <article class="settings-card cloud-main">
        <header><KeyRound :size="20" /><div><h2>凭证与范围</h2><p>主密钥不会发送给登录工具以外的服务。</p></div></header>
        <label class="field"><span>主密钥</span><div class="inline"><input v-model="form.master_key" type="password" autocomplete="off" placeholder="至少 12 位并包含三类字符" /><button class="icon-button" title="复制" @click="copyKey"><Copy :size="17" /></button></div><small :class="strength.valid ? 'success-text' : 'muted'">强度：{{ strength.label }}</small></label>
        <div class="two-fields"><label class="field"><span>记住主密钥</span><select v-model="form.remember_level"><option value="none">不记住</option><option value="master_key">在本地记住</option></select></label><label class="field"><span>同步方向</span><select v-model="form.sync_direction"><option value="pull">云端 → 本地</option><option value="push">本地 → 云端</option><option value="bidirectional">双向同步</option></select></label></div>
        <div class="two-fields"><label class="field"><span>账号范围</span><select v-model="form.scope_type"><option value="all">所有账号</option><option value="current_game">当前游戏</option><option value="selected">指定账号</option></select></label><label class="field"><span>保留时间</span><select v-model.number="form.expire_time"><option :value="3600">1 小时</option><option :value="21600">6 小时</option><option :value="86400">1 天</option><option :value="259200">3 天</option><option :value="604800">1 周</option><option :value="2592000">1 个月</option><option :value="7776000">3 个月</option><option :value="15552000">半年</option><option :value="31536000">1 年</option><option :value="63072000">2 年</option><option :value="94608000">3 年</option></select></label></div>
        <div v-if="form.scope_type === 'selected'" class="scope-list"><label v-for="account in accounts" :key="account.uuid"><input v-model="selectedUuids" type="checkbox" :value="account.uuid" /> {{ account.name || account.uuid }} <small>{{ account.game_id }}</small></label></div>
        <label class="setting-row"><span><strong>启用自动同步</strong><small>账号记录变化后自动上传，启动时自动拉取</small></span><input v-model="form.auto_sync" type="checkbox" /></label>
        <label class="consent"><input v-model="form.consent_ack" type="checkbox" /><span>我已阅读并同意云同步存储与权限说明</span></label>
        <button class="primary wide" @click="save()"><Save :size="17" /> 保存设置</button>
      </article>
      <aside class="cloud-actions">
        <button @click="run('push')"><Upload /> 上传到云端<small>使用当前账号范围</small></button><button @click="run('pull')"><Download /> 下载到本地<small>合并云端账号记录</small></button><button @click="run('sync')"><RefreshCw /> 按方向同步<small>{{ form.sync_direction }}</small></button><button @click="viewLogs"><History /> 查看访问日志</button><button class="danger" @click="removeRemote"><Trash2 /> 删除云端同步</button>
      </aside>
    </div>

    <ModalShell :open="wizardOpen" title="云同步配置向导" @close="wizardOpen = false">
      <div class="wizard-progress"><span v-for="n in 4" :key="n" :class="{ active: n <= wizardStep }"></span></div>
      <div v-if="wizardStep === 1" class="wizard-step"><ShieldCheck :size="48" /><h3>先了解数据如何保存</h3><p>{{ policy?.storage || '云端仅保存加密后的账号记录，主密钥不会上传。' }}</p><label class="consent"><input v-model="form.consent_ack" type="checkbox" />我理解主密钥是访问和恢复数据的唯一凭证</label><label class="field"><span>使用场景</span><select v-model="wizardMode"><option value="import_existing">导入已有同步</option><option value="create_new">创建新的同步</option></select></label></div>
      <div v-else-if="wizardStep === 2" class="wizard-step"><KeyRound :size="48" /><h3>设置主密钥</h3><div class="inline"><input v-model="form.master_key" placeholder="粘贴或生成主密钥" /><button class="primary" @click="generateKey">生成</button></div><p>密钥强度：{{ strength.label }}</p><div class="inline"><button class="ghost" @click="downloadKey">保存为文本</button><label class="ghost file-button">从文本导入<input type="file" accept=".txt,text/plain" @change="importKey" /></label></div><p v-if="probeResult" class="muted">{{ probeResult.exists ? `找到约 ${probeResult.remote_channels_count || 0} 个云端账号` : probeResult.message }}</p></div>
      <div v-else-if="wizardStep === 3" class="wizard-step"><Cloud :size="48" /><h3>同步选项</h3><label class="field"><span>账号范围</span><select v-model="form.scope_type"><option value="all">所有账号</option><option value="current_game">当前游戏</option><option value="selected">指定账号</option></select></label><label class="field"><span>同步方向</span><select v-model="form.sync_direction"><option value="pull">云端 → 本地</option><option value="push">本地 → 云端</option><option value="bidirectional">双向同步</option></select></label><label class="setting-row"><span>自动同步</span><input v-model="form.auto_sync" type="checkbox" /></label></div>
      <div v-else class="wizard-step"><ShieldCheck :size="48" /><h3>准备就绪</h3><p>请确认已经在安全位置保存主密钥。丢失后无法恢复云端数据。</p><label class="consent"><input v-model="wizardRunNow" type="checkbox" />完成后立即执行一次同步</label></div>
      <template #footer><button v-if="wizardStep > 1" class="ghost" @click="wizardStep--">上一步</button><button v-if="wizardStep < 4" class="primary" @click="wizardNext">下一步</button><button v-else class="primary" @click="wizardFinish">完成并保存</button></template>
    </ModalShell>
    <ModalShell :open="logsOpen" title="云同步访问日志" @close="logsOpen = false"><div v-if="!logs.length" class="empty-state">暂无访问日志</div><pre v-else class="log-view">{{ JSON.stringify(logs, null, 2) }}</pre></ModalShell>
  </section>
</template>
