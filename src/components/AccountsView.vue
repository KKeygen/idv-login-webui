<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { LogIn, Pencil, Trash2, Star, UserPlus, CheckSquare, QrCode, CircleHelp } from '@lucide/vue'
import { ApiError, request, resolveTask, openExternal } from '../api'
import { useAppStore } from '../composables/useAppStore'
import ModalShell from './ModalShell.vue'

const app = useAppStore()
const channelNames = { xiaomi_app:'小米账号', huawei:'华为账号', nearme_vivo:'vivo账号', myapp:'应用宝（微信）', myapp_qq:'应用宝（QQ）', oppo:'OPPO账号', bilibili_sdk:'哔哩哔哩账号', honor_sdk:'荣耀账号', uc_platform:'九游账号' }
const selected = ref(new Set())
const channel = ref('')
const qrOpen = ref(false)
const qrData = ref({ status: 'loading', qrcode_base64: '' })
let qrTimer = null

const accounts = computed(() => app.state.accounts.filter(item => !String(item.uuid || '').startsWith('netease')))
const channels = computed(() => {
  const data = app.state.manualChannels
  if (Array.isArray(data)) return data.map(item => { const key = item.channel || item.app_channel; return { ...item, channel: key, name: item.name || channelNames[key] || key } }).filter(item => item.channel)
  return Object.entries(data || {}).map(([channel, value]) => typeof value === 'object' ? { ...value, channel: value.channel || value.app_channel || channel, name: value.name || channel } : { channel, name: String(value || channel) })
})
function formatTime(value) { return value ? new Date(Number(value) * 1000).toLocaleString() : '从未登录' }
function toggle(uuid) { const next = new Set(selected.value); next.has(uuid) ? next.delete(uuid) : next.add(uuid); selected.value = next }
function toggleAll() { selected.value = selected.value.size === accounts.value.length ? new Set() : new Set(accounts.value.map(item => item.uuid)) }
async function login(uuid) {
  let result = await request('/switch', { query: { uuid, game_id: app.state.gameId } })
  result = await resolveTask(result, '/switch-status')
  if (result.result === false || result.success === false) throw new Error(result.error || '账号登录失败，请检查工具日志')
  app.notify('账号登录完成', 'success')
  await app.loadAccounts()
}
async function rename(account) { const name = prompt('新的账号名称', account.name || ''); if (name !== null) await app.mutate('rename', '/rename', { query: { uuid: account.uuid, new_name: name } }) }
async function remove(uuid) { if (confirm('确定删除该账号记录？')) await app.mutate('delete', '/del', { query: { uuid } }) }
async function removeSelected() { if (!selected.value.size || !confirm(`删除选中的 ${selected.value.size} 个账号？`)) return; for (const uuid of selected.value) await request('/del', { query: { uuid } }); selected.value = new Set(); await app.loadAccounts() }
async function setDefault(uuid) { await app.mutate('default', '/setDefault', { query: { uuid, game_id: app.state.gameId } }) }
async function clearDefault() { await app.mutate('clear-default', '/clearDefault', { query: { game_id: app.state.gameId } }) }

function stopQr() { if (qrTimer) clearInterval(qrTimer); qrTimer = null }
async function pollQr(target) {
  try {
    qrData.value = await request('/qrcode', { query: { channel: target, game_id: app.state.gameId, _ts: Date.now() } })
    if (['failed', 'expired'].includes(qrData.value.status)) stopQr()
  } catch { qrData.value.status = 'retrying' }
}
async function importAccount(loginMethod = '') {
  if (!channel.value) return app.notify('请先选择渠道', 'warning')
  const target = channel.value
  if (['myapp', 'bilibili_sdk'].includes(target) && !loginMethod) {
    try {
      qrData.value = await request('/qrcode', { query: { channel: target, game_id: app.state.gameId, _ts: Date.now() } })
      qrOpen.value = true; qrTimer = setInterval(() => pollQr(target), 1000)
    } catch (error) {
      if (!(error instanceof ApiError) || ![404, 500].includes(error.status)) throw error
      // 旧后端没有 QR 状态接口时，保留原有手动登录窗口流程。
    }
  }
  try {
    let result = await request('/import', { query: { channel: target, game_id: app.state.gameId, ...(loginMethod ? { login_method: loginMethod } : {}) } })
    result = await resolveTask(result)
    stopQr(); qrOpen.value = false
    if (result.cancelled) return
    if (!result.success) throw new Error(result.error || '账号导入失败')
    app.notify('账号导入成功', 'success'); await app.loadAccounts()
  } catch (error) { stopQr(); app.notify(error.message, 'error') }
}
async function biliWebLogin() { stopQr(); await request('/cancel-qr').catch(() => {}); await importAccount('web') }
function closeQr() { stopQr(); qrOpen.value = false; request('/cancel-qr').catch(() => {}) }
onBeforeUnmount(stopQr)
</script>

<template>
  <section class="content-page accounts-page">
    <header class="page-title"><div><p class="eyebrow">账号管理</p><h1>选择登录身份</h1><p>登录、整理账号，并为当前游戏设置自动登录。</p></div><div><div class="inline"><select v-model="channel"><option value="">选择登录渠道</option><option v-for="item in channels" :key="item.channel" :value="item.channel">{{ item.name }}</option></select><button class="primary" @click="importAccount()"><UserPlus :size="18" /> 添加账号</button></div><button class="channel-help" @click="openExternal('https://www.yuque.com/keygen/kg2r5k/izpgpf4g3ecqsbf3#WD82D')"><CircleHelp :size="14" /> 没有找到想要登录的渠道？</button></div></header>
    <div class="default-banner"><Star :size="18" /><span>自动登录账号：<strong>{{ app.state.defaultUuid || '未设置' }}</strong></span><button v-if="app.state.defaultUuid" class="ghost compact" @click="clearDefault">清除</button></div>
    <div class="account-toolbar"><button class="ghost" @click="toggleAll"><CheckSquare :size="17" /> {{ selected.size === accounts.length ? '取消全选' : '全选' }}</button><button class="danger ghost" :disabled="!selected.size" @click="removeSelected"><Trash2 :size="17" /> 删除所选</button><span>{{ accounts.length }} 个账号</span></div>
    <div v-if="!accounts.length" class="empty-state"><UserPlus :size="35" /><h2>还没有账号</h2><p>从右上角选择渠道，然后完成登录导入。</p></div>
    <div v-else class="account-grid">
      <article v-for="account in accounts" :key="account.uuid" class="account-card" :class="{ selected: selected.has(account.uuid), default: app.state.defaultUuid === account.uuid }" @click="toggle(account.uuid)">
        <div class="avatar">{{ (account.name || account.uuid || '?').slice(0, 1).toUpperCase() }}</div>
        <div class="account-copy"><h3>{{ account.name || '未命名账号' }}</h3><code>{{ account.uuid }}</code><small>上次登录：{{ formatTime(account.last_login_time) }}</small></div>
        <Star v-if="app.state.defaultUuid === account.uuid" class="default-star" :size="17" fill="currentColor" />
        <div class="account-actions" @click.stop><button class="primary compact" title="登录" @click="login(account.uuid)"><LogIn :size="16" /> 登录</button><button class="icon-button" title="重命名" @click="rename(account)"><Pencil :size="16" /></button><button class="icon-button" title="设为自动登录" @click="setDefault(account.uuid)"><Star :size="16" /></button><button class="icon-button danger" title="删除" @click="remove(account.uuid)"><Trash2 :size="16" /></button></div>
      </article>
    </div>

    <ModalShell :open="qrOpen" title="扫码登录" @close="closeQr">
      <div class="qr-panel"><QrCode v-if="!qrData.qrcode_base64" :size="64" /><img v-else :src="`data:image/png;base64,${qrData.qrcode_base64}`" alt="登录二维码" /><p>{{ ({ idle:'等待开始登录…', loading:'正在获取二维码…', ready:'请使用对应客户端扫码', scanned:'扫码成功，正在校验…', verified:'校验成功，正在导入…', expired:'二维码已过期', failed:'扫码失败', retrying:'连接失败，正在重试…' })[qrData.status] || '正在处理…' }}</p><button v-if="channel === 'bilibili_sdk'" class="ghost" @click="biliWebLogin">使用账号密码或手机号登录</button></div>
    </ModalShell>
  </section>
</template>
