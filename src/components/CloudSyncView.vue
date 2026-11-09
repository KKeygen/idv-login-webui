<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Cloud, KeyRound, RefreshCw, History, Copy, Eye, EyeOff } from '@lucide/vue'
import { ApiError, openExternal, request } from '../api'
import { useAppStore } from '../composables/useAppStore'
import { showConfirm } from '../dialogService'
import ModalShell from './ModalShell.vue'
import WinCheckbox from './WinCheckbox.vue'
import WinSelect from './WinSelect.vue'
import WinSwitch from './WinSwitch.vue'
import WinExpander from './WinExpander.vue'
import MotionProgressRing from './MotionProgressRing.vue'

const app = useAppStore()
const CLOUD_SYNC_POLICY_URL = 'https://kkeygenn.feishu.cn/wiki/ZbgVwYBjliWSoakinFbcqt40n8k'
const supported = ref(true)
const loading = ref(true)
const loaded = ref(false)
const settingsCertain = ref(true)
const accounts = ref([])
const logs = ref([])
const logsOpen = ref(false)
const moreOpen = ref(false)
const wizardOpen = ref(false)
const wizardMode = ref('import_existing')
const keyDraft = ref('')
const showKey = ref(false)
const working = ref('')
const feedback = ref('')
const feedbackError = ref(false)
const keyError = ref('')
let probeGeneration = 0
const form = reactive({ consent_ack: false, master_key: '', remember_level: 'none', auto_sync: false, sync_direction: 'bidirectional', scope_type: 'all', scope_game_id: '', scope_uuids: [], expire_time: 259200 })
const busy = computed(() => loading.value || Boolean(working.value))
const controlsDisabled = computed(() => busy.value || !loaded.value || !settingsCertain.value)
const keyReady = computed(() => evaluateStrength(form.master_key).valid)
const canSync = computed(() => keyReady.value && form.consent_ack && !controlsDisabled.value)
const autoAvailable = computed(() => keyReady.value && form.consent_ack && form.remember_level === 'master_key')
const strength = computed(() => evaluateStrength(keyDraft.value))
const directionOptions = [{ value: 'bidirectional', label: '双向同步' }, { value: 'pull', label: '云端 → 本地' }, { value: 'push', label: '本地 → 云端' }]
const scopeOptions = [{ value: 'all', label: '所有账号' }, { value: 'current_game', label: '当前游戏' }, { value: 'selected', label: '指定账号' }]
const expiryOptions = [{value: 3600, label: '1 小时'}, {value: 21600, label: '6 小时'}, {value: 86400, label: '1 天'}, {value: 259200, label: '3 天'}, {value: 604800, label: '1 周'}, {value: 2592000, label: '1 个月'}, {value: 7776000, label: '3 个月'}, {value: 15552000, label: '半年'}, {value: 31536000, label: '1 年'}, {value: 63072000, label: '2 年'}, {value: 94608000, label: '3 年'}]
const syncDirectionLabel = computed(() => ({ pull: '云端 → 本地', push: '本地 → 云端', bidirectional: '双向同步' })[form.sync_direction] || '按设置同步')
const directionDescription = computed(() => ({ pull: '合并云端账号到本地，不上传。', push: '用所选本地账号更新云端记录。', bidirectional: '先合并云端账号，再上传合并后的结果。' })[form.sync_direction])
const scopeDescription = computed(() => form.scope_type === 'current_game' ? `上传范围已绑定游戏：${app.state.games?.find(game => game.game_id === form.scope_game_id)?.name || form.scope_game_id || '未选择'}` : '只限制上传范围；下载仍会合并云端已有账号。')
function evaluateStrength(value = '') {
  const groups = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(re => re.test(value)).length
  return { valid: value.length >= 12 && groups >= 3, label: !value ? '未输入' : value.length >= 16 && groups >= 4 ? '强' : value.length >= 12 && groups >= 3 ? '合格' : '不足' }
}
function payload(patch = {}) { return { ...form, scope_uuids: [...form.scope_uuids], ...patch } }
function applySettings(data, masterKey = form.master_key) {
  for (const key of Object.keys(form)) if (key !== 'master_key' && key in data) form[key] = key === 'scope_uuids' ? [...(Array.isArray(data[key]) ? data[key] : [])] : data[key]
  form.master_key = data.saved_master_key || masterKey
}
function report(message, error = false) { feedback.value = message; feedbackError.value = error }
async function readSettings() {
  const result = await request('/cloud-sync/settings')
  if (result.success !== true || !result.settings || typeof result.settings !== 'object') throw new Error('Invalid settings response')
  applySettings(result.settings)
  settingsCertain.value = true
}
async function load() {
  if (working.value) return
  loading.value = true
  try {
    await readSettings()
    loaded.value = true
    const [policyData, accountsData] = await Promise.allSettled([request('/cloud-sync/policy'), request('/cloud-sync/accounts')])
    if (accountsData.status === 'fulfilled' && Array.isArray(accountsData.value?.accounts)) accounts.value = accountsData.value.accounts
    if (policyData.status === 'rejected' || accountsData.status === 'rejected') report('部分辅助信息读取失败，设置仍可使用。', true)
    else report('选项更改后自动保存。')
  } catch (error) {
    settingsCertain.value = false
    if (error instanceof ApiError && error.status === 404) { supported.value = false; app.markUpdateRequired() }
    else report('设置读取失败，请重新读取后再修改。', true)
  } finally { loading.value = false }
}
async function persistSettings(patch, successText = '设置已更新') {
  if (controlsDisabled.value) return false
  const next = payload(patch)
  if (next.remember_level === 'master_key' && !evaluateStrength(next.master_key).valid) { report('请先配置有效的主密钥。', true); return false }
  if (next.auto_sync && (!next.consent_ack || next.remember_level !== 'master_key')) { report('自动同步需要先同意说明，并在本地记住主密钥。', true); return false }
  working.value = 'save'
  report('正在更新…')
  try {
    const result = await request('/cloud-sync/settings', { method: 'POST', body: next })
    if (result.success !== true) { report('更新失败，已保留原设置。请重试。', true); return false }
    // Older backends may acknowledge without echoing settings. Never apply a
    // partially edited key or a different game's scope from unrelated controls.
    applySettings(result.settings || next, next.master_key)
    report(successText)
    return true
  } catch {
    // A transport error does not prove that the server rejected the write.
    // Read back once; do not blindly resend or claim that a rollback succeeded.
    try { await readSettings(); report('未收到更新确认，已重新读取当前设置。请核对后再操作。', true) }
    catch { settingsCertain.value = false; report('无法确认更新结果。请重新读取设置，避免重复覆盖。', true) }
    return false
  } finally { working.value = '' }
}
function setConsent(next) { return persistSettings({ consent_ack: next, ...(!next ? { auto_sync: false } : {}) }, next ? '已记录您的选择' : '已撤回同意，并关闭自动同步') }
function setRemember(next) { return persistSettings({ remember_level: next ? 'master_key' : 'none', ...(!next ? { auto_sync: false } : {}) }, next ? '已在本地记住主密钥' : '不再记住主密钥，自动同步已关闭') }
function setScope(value) { return persistSettings({ scope_type: value, scope_game_id: value === 'current_game' ? app.state.gameId : '' }) }
function setAccount(uuid, next) { return persistSettings({ scope_uuids: next ? [...new Set([...form.scope_uuids, uuid])] : form.scope_uuids.filter(value => value !== uuid) }) }
async function run(action) {
  if (!canSync.value) return
  working.value = `run-${action}`
  report('正在同步…')
  try {
    const data = await request('/cloud-sync/run', { method: 'POST', body: payload({ action }) })
    if (data.success !== true || data.steps?.some(step => step?.success === false)) throw new Error('Sync failed')
    await app.loadAccounts({ force: true })
    report(data.skipped ? '本次同步已跳过' : '同步完成')
  } catch { report('未能确认同步完成。请查看访问日志，确认结果后再试。', true) }
  finally { working.value = '' }
}
async function removeRemote() {
  if (!canSync.value) return
  const confirmed = await showConfirm('云端密文与同步设置将被删除，本地账号记录不会受到影响。', { title: '删除云端同步', confirmText: '删除云端数据', danger: true })
  if (!confirmed || working.value) return
  working.value = 'delete'
  try {
    const data = await request('/cloud-sync/delete', { method: 'POST', body: { master_key: form.master_key } })
    if (data.success !== true) throw new Error('Delete failed')
    form.auto_sync = false; form.remember_level = 'none'; form.consent_ack = false; form.master_key = ''
    report('云端同步已删除，本地账号未改变。')
  } catch { report('无法确认云端数据是否已删除。请查看访问日志，勿重复删除。', true) }
  finally { working.value = '' }
}
async function viewLogs() {
  if (busy.value || !keyReady.value) return
  working.value = 'logs'
  try {
    const data = await request('/cloud-sync/access-logs', { method: 'POST', body: { master_key: form.master_key } })
    if (data.success !== true) throw new Error('Logs unavailable')
    logs.value = data.logs || []; logsOpen.value = true
  } catch { report('访问日志读取失败，请稍后重试。', true) }
  finally { working.value = '' }
}
function openWizard() {
  if (controlsDisabled.value) return
  probeGeneration += 1
  wizardMode.value = 'import_existing'; keyDraft.value = form.master_key; keyError.value = ''; showKey.value = false
  wizardOpen.value = true
}
function closeWizard() {
  if (working.value) return
  probeGeneration += 1; wizardOpen.value = false; keyDraft.value = ''; showKey.value = false; keyError.value = ''
}
async function generateKey() {
  if (busy.value) return
  working.value = 'generate'
  try {
    const data = await request('/cloud-sync/generate-master-key', { method: 'POST', body: { length: 16 } })
    if (data.success !== true || !evaluateStrength(data.master_key).valid) throw new Error('Generation failed')
    keyDraft.value = data.master_key; keyError.value = ''
  } catch { keyError.value = '生成失败，请重试或自行输入。' }
  finally { working.value = '' }
}
async function copyKey() {
  try { await navigator.clipboard.writeText(keyDraft.value); keyError.value = ''; app.notify('主密钥已复制，请妥善保管', 'success') }
  catch { keyError.value = '无法复制，请手动选择密钥后复制。' }
}
function downloadKey() {
  const blob = new Blob([`IdentityV Login Helper Cloud Sync\nmaster_key=${keyDraft.value}\n`], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `idv-cloud-master-key-${new Date().toISOString().slice(0,10)}.txt`; a.click(); URL.revokeObjectURL(a.href)
}
async function importKey(event) {
  if (busy.value) return
  const file = event.target.files?.[0]
  if (!file) return
  const generation = probeGeneration
  working.value = 'import'
  try {
    const raw = await file.text()
    if (generation !== probeGeneration || !wizardOpen.value) return
    keyDraft.value = (raw.match(/master_key\s*=\s*([^\r\n]+)/i)?.[1] || raw).trim(); keyError.value = ''
  } catch { keyError.value = '文件读取失败，请重新选择。' }
  finally { working.value = ''; event.target.value = '' }
}
async function wizardFinish() {
  if (busy.value || !strength.value.valid) return
  const generation = ++probeGeneration, masterKey = keyDraft.value, mode = wizardMode.value
  keyError.value = ''
  if (mode === 'import_existing') {
    working.value = 'probe'
    try {
      const result = await request('/cloud-sync/probe', { method: 'POST', body: { master_key: masterKey } })
      if (generation !== probeGeneration || !wizardOpen.value || keyDraft.value !== masterKey || wizardMode.value !== mode) return
      if (result.success !== true || !result.exists) { keyError.value = '未找到对应的云端记录。请检查密钥，或选择创建新同步。'; return }
    } catch { keyError.value = '验证失败，请确认网络正常后重试。'; return }
    finally { working.value = '' }
  }
  if (generation !== probeGeneration || !wizardOpen.value) return
  // Changing the key changes the remote record. Keep automatic transfers off
  // until the user explicitly enables them for this newly selected record.
  const saved = await persistSettings({ master_key: masterKey, auto_sync: false, sync_direction: mode === 'import_existing' ? 'pull' : 'bidirectional' }, '主密钥已配置。点击“立即同步”开始。')
  if (saved) closeWizard()
  else keyError.value = feedback.value
}
onMounted(load)
</script>

<template>
  <section class="content-page cloud-page">
    <header class="page-title"><div><h1>云同步</h1><p>在设备之间同步账号。云端只保存密文。</p></div></header>
    <div v-if="!supported" class="empty-state"><Cloud :size="38" /><h2>当前工具版本暂不支持云同步</h2><p>请更新工具后再使用。</p></div>
    <div v-else-if="loading" class="content-loading"><MotionProgressRing :size="28" aria-label="正在读取云同步设置" /><span>正在读取设置…</span></div>
    <div v-else class="cloud-settings">
      <div class="cloud-feedback" :class="{ 'is-error': feedbackError }" :role="feedbackError ? 'alert' : 'status'" aria-live="polite"><span>{{ feedback }}</span><button v-if="!settingsCertain" class="text-button" :disabled="busy" @click="load">重新读取</button></div>
      <section class="cloud-connection" aria-label="同步连接">
        <KeyRound :size="24" />
        <div><h2>{{ keyReady ? '主密钥已就绪' : '先配置主密钥' }}</h2><p>{{ keyReady ? (form.remember_level === 'master_key' ? '已在本地记住，可在下次启动后继续使用。' : '仅在本次使用，重启工具后需要重新输入。') : '导入已有同步，或创建一份新的云端记录。' }}</p></div>
        <button class="quiet-button" :disabled="controlsDisabled" @click="openWizard">{{ keyReady ? '更换主密钥' : '配置同步' }}</button>
        <button class="primary cloud-sync-now" :disabled="!canSync" @click="run('sync')"><MotionProgressRing v-if="working.startsWith('run-')" :size="17" aria-label="正在同步" /><RefreshCw v-else :size="17" />立即同步</button>
      </section>
      <p class="cloud-security-note">主密钥不会上传。丢失后无法恢复云端内容，获得它的人可以访问或删除该记录。</p>
      <label class="cloud-consent"><WinCheckbox :model-value="form.consent_ack" :disabled="controlsDisabled" @change="setConsent" /><span>我已阅读并同意 <a :href="CLOUD_SYNC_POLICY_URL" @click.stop.prevent="openExternal(CLOUD_SYNC_POLICY_URL)">云同步说明和隐私政策</a></span></label>
      <section class="cloud-preferences" aria-label="同步偏好">
        <div class="cloud-setting-row"><div><label for="cloud-remember">在本地记住主密钥</label><small>关闭时会同时关闭自动同步。</small></div><WinSwitch id="cloud-remember" :model-value="form.remember_level === 'master_key'" :disabled="controlsDisabled || !keyReady" @change="setRemember" /></div>
        <div class="cloud-setting-row"><div><label for="cloud-auto">自动同步</label><small>{{ autoAvailable ? '启动时同步，账号变化后自动上传。' : '需要同意说明，并在本地记住有效主密钥。' }}</small></div><WinSwitch id="cloud-auto" :model-value="form.auto_sync" :disabled="controlsDisabled || (!form.auto_sync && !autoAvailable)" @change="next => persistSettings({ auto_sync: next })" /></div>
        <div class="cloud-setting-row"><div><label for="cloud-direction">同步方向</label><small>{{ directionDescription }}</small></div><WinSelect id="cloud-direction" :model-value="form.sync_direction" :disabled="controlsDisabled" :options="directionOptions" @change="event => persistSettings({ sync_direction: event.value })" /></div>
        <div class="cloud-setting-row"><div><label for="cloud-scope">上传账号范围</label><small>{{ scopeDescription }}</small></div><WinSelect id="cloud-scope" :model-value="form.scope_type" :disabled="controlsDisabled" :options="scopeOptions" @change="event => setScope(event.value)" /></div>
        <div v-if="form.scope_type === 'selected'" class="cloud-account-selection"><p v-if="!accounts.length" class="muted">暂无可选择的本地账号。</p><label v-for="account in accounts" :key="account.uuid"><WinCheckbox :model-value="form.scope_uuids.includes(account.uuid)" :disabled="controlsDisabled" @change="next => setAccount(account.uuid, next)" /><span>{{ account.name || account.uuid }}<small>{{ account.game_id }}</small></span></label></div>
      </section>
      <WinExpander v-model:expanded="moreOpen" title="更多选项与记录">
        <div class="cloud-setting-row cloud-expiry"><div><label for="cloud-expiry">云端保留时间</label><small>每次上传时续期；到期可能清除云端密文，不影响本地账号。</small></div><WinSelect id="cloud-expiry" :model-value="form.expire_time" :options="expiryOptions" :disabled="controlsDisabled" @change="event => persistSettings({ expire_time: event.value })" /></div>
        <div class="cloud-manual-actions"><button class="quiet-button" :disabled="!canSync" @click="run('push')">仅上传</button><button class="quiet-button" :disabled="!canSync" @click="run('pull')">仅下载</button><button class="quiet-button" :disabled="busy || !keyReady" @click="viewLogs"><History :size="16" />访问日志</button></div>
        <p class="muted cloud-action-note">仅上传会按所选范围更新云端；仅下载会合并到本地。</p>
        <div class="cloud-danger-row"><span>删除云端密文与同步设置，本地账号不受影响。</span><button class="quiet-button danger" :disabled="!canSync" @click="removeRemote">删除云端同步</button></div>
      </WinExpander>
    </div>

    <ModalShell :open="wizardOpen" title="配置主密钥" :dismissible="!working" @close="closeWizard">
      <div class="cloud-key-setup">
        <fieldset class="cloud-setup-mode" :disabled="busy"><legend>使用方式</legend><label><input v-model="wizardMode" type="radio" value="import_existing" name="cloud-key-mode" @change="keyError = ''" />导入已有同步</label><label><input v-model="wizardMode" type="radio" value="create_new" name="cloud-key-mode" @change="keyError = ''" />创建新同步</label></fieldset>
        <p>{{ wizardMode === 'import_existing' ? '输入原来的主密钥，验证后即可使用。不会立即上传或下载账号。' : '生成或输入新主密钥，并妥善保存。首次点击立即同步后才会创建云端记录。' }}</p>
        <label class="field" for="cloud-key-input"><span>主密钥</span><div class="inline"><input id="cloud-key-input" v-model="keyDraft" :type="showKey ? 'text' : 'password'" :disabled="busy" autocomplete="off" placeholder="至少 12 位，包含三类字符" @input="keyError = ''" /><button class="icon-button" :disabled="busy" :aria-label="showKey ? '隐藏主密钥' : '显示主密钥'" @click="showKey = !showKey"><EyeOff v-if="showKey" :size="17" /><Eye v-else :size="17" /></button><button v-if="wizardMode === 'create_new'" class="quiet-button" :disabled="busy" @click="generateKey">生成</button></div><small>强度：{{ strength.label }}。需包含大写、小写、数字、符号中的三类。</small></label>
        <div class="cloud-key-tools"><button class="text-button" :disabled="busy || !keyDraft" @click="copyKey"><Copy :size="15" />复制</button><button class="text-button" :disabled="busy || !keyDraft" @click="downloadKey">保存为文本</button><label class="text-button file-button" :class="{ disabled: busy }">从文本导入<input type="file" accept=".txt,text/plain" :disabled="busy" @change="importKey" /></label></div>
        <p class="cloud-security-note">不记住主密钥时，它只用于本次会话。更换密钥会关闭自动同步，请先确认新记录再开启。</p>
        <p v-if="keyError" class="cloud-inline-error" role="alert">{{ keyError }}</p>
      </div>
      <template #footer><button class="quiet-button" :disabled="busy" @click="closeWizard">取消</button><button class="primary" :disabled="busy || !strength.valid" @click="wizardFinish"><MotionProgressRing v-if="working" :size="16" />{{ working === 'probe' ? '正在验证…' : working ? '正在更新…' : wizardMode === 'import_existing' ? '验证并使用' : '使用新密钥' }}</button></template>
    </ModalShell>
    <ModalShell :open="logsOpen" title="云同步访问日志" @close="logsOpen = false"><div v-if="!logs.length" class="empty-state">暂无访问日志</div><pre v-else class="log-view">{{ JSON.stringify(logs, null, 2) }}</pre></ModalShell>
  </section>
</template>

<style scoped>
.cloud-settings { width: min(880px, 100%); margin: 0 auto; }
.cloud-feedback { display: flex; align-items: center; gap: 12px; min-height: 28px; margin-bottom: 16px; font-size: 13px; color: var(--text-secondary, #ffffffb3); }
.cloud-feedback.is-error, .cloud-inline-error { color: #ffb4ab; }
.cloud-connection { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; padding: 0 0 16px; }
.cloud-connection > div { flex: 1; min-width: 220px; }
.cloud-connection h2 { margin: 0 0 6px; font-size: 18px; }
.cloud-connection p { margin: 0; font-size: 13px; color: #ffffffb3; line-height: 1.5; }
.cloud-sync-now { display: inline-flex; align-items: center; gap: 8px; }
.cloud-security-note { font-size: 12px; line-height: 1.65; color: #ffffff9e; margin: 0 0 12px; }
.cloud-consent { display: flex; align-items: center; gap: 10px; font-size: 13px; margin: 12px 0 24px; }
.cloud-consent a { color: var(--accent); }
.cloud-preferences { margin-bottom: 24px; }
.cloud-setting-row { display: flex; align-items: center; justify-content: space-between; gap: 24px; min-height: 78px; padding: 14px 0; border-top: 1px solid #ffffff12; }
.cloud-setting-row > div { flex: 1; min-width: 0; }
.cloud-setting-row label { display: block; font-size: 14px; color: #fff; }
.cloud-setting-row small { display: block; font-size: 12px; color: #ffffff9e; line-height: 1.5; margin-top: 6px; }
.cloud-setting-row :deep(.win-select) { width: 210px; flex: 0 0 210px; }
.cloud-expiry { padding-top: 0; border-top: 0; }
.cloud-account-selection { display: grid; gap: 12px; padding: 8px 0 18px 12px; }
.cloud-account-selection label { display: flex; align-items: center; gap: 10px; font-size: 14px; }
.cloud-account-selection small { margin-left: 10px; font-size: 12px; color: #ffffff9e; }
.cloud-manual-actions, .cloud-key-tools { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
.cloud-manual-actions button, .cloud-key-tools button { display: inline-flex; align-items: center; gap: 6px; }
.cloud-action-note { margin-top: 10px; font-size: 12px; }
.cloud-danger-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 20px; padding-top: 16px; border-top: 1px solid #ffffff12; font-size: 12px; color: #ffffff9e; }
.cloud-key-setup { display: grid; gap: 18px; }
.cloud-key-setup > p { font-size: 13px; line-height: 1.6; margin: 0; }
.cloud-setup-mode { display: flex; flex-wrap: wrap; gap: 20px; margin: 0; padding: 0; border: 0; }
.cloud-setup-mode legend { font-size: 13px; margin-bottom: 12px; color: #ffffffb3; }
.cloud-setup-mode label { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.cloud-key-setup .field { margin: 0; }
.cloud-key-setup .inline > input { flex: 1; min-width: 0; }
@media (max-width: 650px) { .cloud-setting-row { align-items: flex-start; gap: 12px; } .cloud-setting-row :deep(.win-select) { width: 160px; flex-basis: 160px; } .cloud-connection > div { min-width: 160px; } .cloud-danger-row { align-items: flex-start; flex-direction: column; } }
@media (max-width: 430px) { .cloud-setting-row:has(.win-select) { flex-direction: column; } .cloud-setting-row :deep(.win-select) { width: 100%; flex-basis: auto; } }
</style>
