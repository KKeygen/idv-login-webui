<script setup>
import { computed, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import { Check, LogIn, Pencil, Trash2, Star, UserPlus, CheckSquare, QrCode, CircleHelp } from '@lucide/vue'
import { ApiError, request, resolveTask, openExternal } from '../api'
import { cmpGameId, useAppStore } from '../composables/useAppStore'
import { showConfirm, showPrompt } from '../dialogService'
import ModalShell from './ModalShell.vue'
import MotionProgressRing from './MotionProgressRing.vue'

const app = useAppStore()
const channelNames = { xiaomi_app:'小米账号', huawei:'华为账号', nearme_vivo:'vivo账号', myapp:'应用宝（微信）', myapp_qq:'应用宝（QQ）', oppo:'OPPO账号', bilibili_sdk:'哔哩哔哩账号', honor_sdk:'荣耀账号', uc_platform:'九游账号' }
const selected = ref(new Set())
const channel = ref('')
const qrOpen = ref(false)
const qrData = ref({ status: 'loading', qrcode_base64: '' })
let qrTimer = null
let qrGameId = ''

const qrReadyHints = { myapp:'请使用微信扫描二维码登录', bilibili_sdk:'请使用哔哩哔哩扫描二维码登录', huawei:'请使用手机浏览器扫描二维码登录' }
const qrStatusText = computed(() => {
  const map = {
    idle:'等待开始登录… 如果长时间没有反应，可能是您的工具版本太旧，请更新',
    loading:'正在获取二维码…',
    ready: qrReadyHints[channel.value] || '请使用对应客户端扫码',
    scanned:'扫码成功，正在校验…',
    verified:'校验成功，正在导入…',
    expired:'二维码已过期',
    failed:'扫码失败',
    retrying:'连接失败，正在重试…',
  }
  return map[qrData.value.status] || '正在处理…'
})

const accounts = computed(() => app.state.accounts.filter(item => !String(item.uuid || '').startsWith('netease')))
const defaultAccountLabel = computed(() => {
  const account = accounts.value.find(item => item.uuid === app.state.defaultUuid)
  return account?.name || account?.uuid || '未设置'
})
const channels = computed(() => {
  const data = app.state.manualChannels
  const list = Array.isArray(data)
    ? data.map(item => { const key = item.channel || item.app_channel; return { ...item, channel: key, name: item.name || channelNames[key] || key } }).filter(item => item.channel)
    : Object.entries(data || {}).map(([channel, value]) => typeof value === 'object' ? { ...value, channel: value.channel || value.app_channel || channel, name: value.name || channel } : { channel, name: String(value || channel) })
  if (list.some(item => item.channel === 'myapp') && !list.some(item => item.channel === 'myapp_qq')) {
    list.push({ channel: 'myapp_qq', name: channelNames['myapp_qq'] || '应用宝（QQ）' })
  }
  return list
})
function formatTime(value) { return value ? new Date(Number(value) * 1000).toLocaleString() : '从未登录' }
function toggle(uuid) { const next = new Set(selected.value); next.has(uuid) ? next.delete(uuid) : next.add(uuid); selected.value = next }
function toggleAll() { selected.value = selected.value.size === accounts.value.length ? new Set() : new Set(accounts.value.map(item => item.uuid)) }
async function login(uuid) {
  const gameId = app.state.gameId
  let result = await request('/switch', { query: { uuid, game_id: gameId } })
  result = await resolveTask(result, '/switch-status')
  if (result.result === false || result.success === false) throw new Error(result.error || '账号登录失败，请检查工具日志')
  app.notify(cmpGameId(gameId, app.state.gameId) ? '账号登录完成' : '账号登录已在原游戏中完成', 'success')
  if (cmpGameId(gameId, app.state.gameId)) await app.loadAccounts({ force: true })
}
async function rename(account) {
  const name = await showPrompt('输入这个账号的新名称。', { title: '重命名账号', inputLabel: '账号名称', defaultValue: account.name || '', confirmText: '保存' })
  if (name !== null) await app.mutate('rename', '/rename', { query: { uuid: account.uuid, new_name: name } })
}
async function remove(uuid) {
  const confirmed = await showConfirm('删除后需要重新导入才能再次使用该账号。', { title: '删除账号记录', confirmText: '删除', danger: true })
  if (confirmed) await app.mutate('delete', '/del', { query: { uuid } })
}
async function removeSelected() {
  if (!selected.value.size) return
  const confirmed = await showConfirm(`将删除选中的 ${selected.value.size} 个账号记录。`, { title: '批量删除账号', confirmText: '全部删除', danger: true })
  if (!confirmed) return
  for (const uuid of selected.value) await request('/del', { query: { uuid } })
  selected.value = new Set()
  await app.loadAccounts({ force: true })
}
async function setDefault(uuid) { await app.mutate('default', '/setDefault', { query: { uuid, game_id: app.state.gameId } }) }
async function clearDefault() { await app.mutate('clear-default', '/clearDefault', { query: { game_id: app.state.gameId } }) }
async function toggleDefault(uuid) { app.state.defaultUuid === uuid ? await clearDefault() : await setDefault(uuid) }

function stopQr() { if (qrTimer) clearTimeout(qrTimer); qrTimer = null }
function qrScopeMatches(gameId) {
  return Boolean(qrOpen.value && cmpGameId(gameId, app.state.gameId) && cmpGameId(gameId, qrGameId))
}
function scheduleQrPoll(target, gameId) {
  stopQr()
  if (!qrScopeMatches(gameId)) return
  qrTimer = setTimeout(() => {
    qrTimer = null
    pollQr(target, gameId)
  }, 1000)
}
async function pollQr(target, gameId) {
  if (!qrScopeMatches(gameId)) return stopQr()
  try {
    const data = await request('/qrcode', { query: { channel: target, game_id: gameId, _ts: Date.now() } })
    if (!qrScopeMatches(gameId)) return
    qrData.value = data
  } catch {
    if (qrScopeMatches(gameId)) qrData.value.status = 'retrying'
  } finally {
    if (qrScopeMatches(gameId) && !['failed', 'expired'].includes(qrData.value.status)) {
      scheduleQrPoll(target, gameId)
    } else {
      stopQr()
    }
  }
}
async function importAccount(loginMethod = '') {
  if (!channel.value) return app.notify('请先选择渠道', 'warning')
  const target = channel.value
  const gameId = app.state.gameId
  if (['myapp', 'bilibili_sdk', 'huawei'].includes(target) && !loginMethod) {
    try {
      qrData.value = await request('/qrcode', { query: { channel: target, game_id: gameId, _ts: Date.now() } })
      if (!cmpGameId(gameId, app.state.gameId)) {
        request('/cancel-qr').catch(() => {})
        return
      }
      qrGameId = gameId
      qrOpen.value = true
      scheduleQrPoll(target, gameId)
    } catch (error) {
      if (!(error instanceof ApiError) || ![404, 500].includes(error.status)) throw error
      // 旧后端没有 QR 状态接口时，保留原有手动登录窗口流程。
    }
  }
  try {
    let result = await request('/import', { query: { channel: target, game_id: gameId, ...(loginMethod ? { login_method: loginMethod } : {}) } })
    result = await resolveTask(result)
    stopQr(); qrOpen.value = false
    if (result.cancelled) return
    if (!result.success) throw new Error(result.error || '账号导入失败')
    app.notify(cmpGameId(gameId, app.state.gameId) ? '账号导入成功' : '账号已导入到原游戏', 'success')
    if (cmpGameId(gameId, app.state.gameId)) await app.loadAccounts({ force: true })
  } catch (error) { stopQr(); app.notify(error.message, 'error') }
}
async function biliWebLogin() { stopQr(); await request('/cancel-qr').catch(() => {}); await importAccount('web') }
function closeQr() { stopQr(); qrOpen.value = false; qrGameId = ''; request('/cancel-qr').catch(() => {}) }
watch(() => app.state.gameId, (gameId, previous) => {
  selected.value = new Set()
  channel.value = ''
  if (!cmpGameId(gameId, previous) && qrOpen.value) closeQr()
})
watch(accounts, list => {
  const available = new Set(list.map(item => item.uuid))
  const next = new Set([...selected.value].filter(uuid => available.has(uuid)))
  if (next.size !== selected.value.size) selected.value = next
})
watch(channels, list => {
  if (channel.value && !list.some(item => item.channel === channel.value)) channel.value = ''
})
function leaveAccounts() {
  if (qrOpen.value) closeQr()
  else stopQr()
}
onBeforeUnmount(leaveAccounts)
onDeactivated(leaveAccounts)
</script>

<template>
  <section class="content-page accounts-page">
    <header class="page-title"><div><p class="eyebrow">账号管理</p><h1>选择登录身份</h1><p>登录、整理账号，并为当前游戏设置自动登录。</p></div><div class="account-login-entry"><div class="account-login-capsule"><select v-model="channel" aria-label="选择登录渠道"><option value="">选择登录渠道</option><option v-for="item in channels" :key="item.channel" :value="item.channel">{{ item.name }}</option></select><button class="primary" @click="importAccount()"><UserPlus :size="18" /><span>登录账号</span></button></div><button class="channel-help" @click="openExternal('https://www.yuque.com/keygen/kg2r5k/izpgpf4g3ecqsbf3#WD82D')"><CircleHelp :size="14" /> 没有找到想要登录的渠道？</button></div></header>
    <div v-if="!accounts.length" class="empty-state"><UserPlus :size="35" /><h2>还没有账号</h2><p>从右上角选择渠道，然后完成登录导入。</p></div>
    <section v-else class="account-list">
      <header class="account-list-toolbar">
        <div><Star :size="17" /><span>自动登录：<strong>{{ defaultAccountLabel }}</strong></span><button v-if="app.state.defaultUuid" class="text-button" @click="clearDefault">关闭</button></div>
        <div><button class="quiet-button" @click="toggleAll"><CheckSquare :size="16" />{{ selected.size === accounts.length ? '取消全选' : '全选' }}</button><button class="quiet-button danger" :disabled="!selected.size" @click="removeSelected"><Trash2 :size="16" />删除所选</button><span>{{ accounts.length }} 个账号</span></div>
      </header>
      <div class="account-list-columns" aria-hidden="true"><span></span><span>账号</span><span>上次登录</span><span>自动登录</span><span>操作</span></div>
      <TransitionGroup name="list-item" tag="div" class="account-list-body">
      <article
        v-for="account in accounts"
        :key="account.uuid"
        class="account-list-row"
        data-reveal
        :class="{ selected: selected.has(account.uuid), default: app.state.defaultUuid === account.uuid }"
        role="button"
        tabindex="0"
        @click="toggle(account.uuid)"
        @keydown.space.prevent="toggle(account.uuid)"
      >
        <span class="account-selection"><Check v-if="selected.has(account.uuid)" :size="14" /></span>
        <div class="account-identity"><div class="avatar">{{ (account.name || account.uuid || '?').slice(0, 1).toUpperCase() }}</div><div class="account-copy"><h3>{{ account.name || '未命名账号' }}</h3><code>{{ account.uuid }}</code></div></div>
        <time>{{ formatTime(account.last_login_time) }}</time>
        <div><button class="account-auto-login-toggle" :class="{ active: app.state.defaultUuid === account.uuid }" role="switch" :aria-checked="app.state.defaultUuid === account.uuid" :title="app.state.defaultUuid === account.uuid ? '关闭此账号的自动登录' : '将此账号设为自动登录'" @click.stop="toggleDefault(account.uuid)"><span class="account-auto-login-track" aria-hidden="true"></span><span>{{ app.state.defaultUuid === account.uuid ? '开启' : '关闭' }}</span></button></div>
        <div class="account-actions" @click.stop><button class="quiet-button account-login" title="登录" @click="login(account.uuid)"><LogIn :size="15" />登录</button><button class="account-icon-action" title="重命名" @click="rename(account)"><Pencil :size="15" /></button><button class="account-icon-action danger" title="删除" @click="remove(account.uuid)"><Trash2 :size="15" /></button></div>
      </article>
      </TransitionGroup>
    </section>

    <ModalShell :open="qrOpen" title="扫码登录" @close="closeQr">
      <div class="qr-panel"><MotionProgressRing v-if="!qrData.qrcode_base64 && ['loading','scanned','verified','retrying'].includes(qrData.status)" :size="42" aria-label="正在处理扫码登录" /><QrCode v-else-if="!qrData.qrcode_base64" :size="64" /><img v-else :src="`data:image/png;base64,${qrData.qrcode_base64}`" alt="登录二维码" /><p>{{ qrStatusText }}</p><button v-if="channel === 'bilibili_sdk' || channel === 'huawei'" class="ghost" @click="biliWebLogin">使用账号密码或手机号登录</button></div>
    </ModalShell>
  </section>
</template>
