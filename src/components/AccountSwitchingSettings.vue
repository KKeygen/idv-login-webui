<script setup>
import { computed, onDeactivated, ref, watch } from 'vue'
import WinExpander from './WinExpander.vue'
import WinSwitch from './WinSwitch.vue'
import WinCheckbox from './WinCheckbox.vue'
import MotionProgressRing from './MotionProgressRing.vue'
import { normalizeSwitchingConfig, recentAccounts } from '../accountSwitching'
import { useAccountSwitching } from '../composables/useAccountSwitching'
import { gameTitle, shortGameId, useAppStore } from '../composables/useAppStore'

const app = useAppStore()
const switching = useAccountSwitching()
const expanded = ref(false)
const busy = ref(false)
const feedback = ref('')
const failed = ref(false)
const scope = computed(() => shortGameId(app.state.gameId))
const game = computed(() => switching.state.games.find(item => item.short_game_id === scope.value))
const choice = computed(() => switching.state.config.games[scope.value] || { enabled: false, account_uuids: [] })
const accounts = computed(() => recentAccounts(game.value?.accounts || []))
const disabled = computed(() => busy.value || switching.state.loading || switching.state.saving || !switching.state.loaded)
let editGeneration = 0
async function toggle(value) {
  if (busy.value || switching.state.saving) return
  expanded.value = value
  editGeneration += 1
  if (value) await reload()
}
async function reload() {
  feedback.value = ''
  failed.value = false
  await switching.load({ force: true })
}
async function updateChoice(patch) {
  if (disabled.value || !game.value) return
  const target = scope.value
  const generation = editGeneration
  // This API replaces the games map. Preserve every other game and global option;
  // onboarding recommendations must never turn into unrelated saved selections.
  const config = normalizeSwitchingConfig(switching.state.config)
  config.games[target] = { ...choice.value, account_uuids: [...choice.value.account_uuids], ...patch }
  busy.value = true
  feedback.value = ''
  failed.value = false
  try {
    if (await switching.save(config)) {
      if (generation === editGeneration) feedback.value = '已保存，下次启动工具时应用。'
    } else {
      // A lost response may already have committed. Read once, never resend.
      const current = await switching.load({ force: true })
      if (generation === editGeneration) {
        failed.value = true
        feedback.value = current ? '更新未获确认，已重新读取当前设置。请核对后再操作。' : '无法确认更新结果，请重新读取后再操作。'
      }
    }
  } finally { busy.value = false }
}
function selectAccount(uuid, checked) {
  const selected = choice.value.account_uuids
  updateChoice({ account_uuids: checked ? [...new Set([...selected, uuid])] : selected.filter(value => value !== uuid) })
}
function formatTime(value) {
  if (!value) return '从未登录'
  const date = new Date(Number(value) * 1000)
  return Number.isNaN(date.getTime()) ? '登录时间未知' : date.toLocaleDateString()
}
watch(scope, () => { editGeneration += 1; feedback.value = ''; failed.value = false })
onDeactivated(() => { expanded.value = false; editGeneration += 1 })
</script>

<template>
  <section v-if="switching.supported.value" class="switching-settings">
    <WinExpander :expanded="expanded" title="同步游戏内的账号" :disabled="busy || switching.state.saving" @update:expanded="toggle">
      <div class="switching-current-game">
        <div v-if="switching.state.loading" class="content-loading"><MotionProgressRing :size="24" aria-label="正在读取账号切换设置" /><span>正在读取设置…</span></div>
        <div v-else-if="!switching.state.loaded" class="switching-load-error" role="alert"><p>{{ feedback || switching.state.error }}</p><button class="quiet-button" :disabled="busy" @click="reload">重新读取</button></div>
        <p v-else-if="!game" class="switching-inline-empty">当前游戏没有可配置的账号同步设置。</p>
        <template v-else>
          <label class="switching-game-toggle"><span><strong>{{ gameTitle(game) }}</strong><small>将勾选的工具账号显示在本游戏中。同一游戏的不同安装共用此设置。</small></span><WinSwitch aria-label="同步当前游戏的账号" :model-value="choice.enabled" :disabled="disabled" @change="enabled => updateChoice({ enabled })" /></label>
          <p v-if="!switching.state.config.enabled" class="switching-scope-note">账号同步目前已全局暂停。这里保留本游戏的选择；可在应用设置中重新启用。</p>
          <template v-if="choice.enabled">
            <div class="switching-scope-heading"><strong>在游戏内显示的账号</strong><span>已选 {{ choice.account_uuids.length }} 个</span></div>
            <ul v-if="accounts.length" class="switching-scope-accounts">
              <li v-for="account in accounts" :key="account.uuid"><label><WinCheckbox :checked="choice.account_uuids.includes(account.uuid)" :disabled="disabled" :aria-label="`同步${account.display_name || account.name || '未命名账号'}`" @change="checked => selectAccount(account.uuid, checked)" /><span><strong>{{ account.display_name || account.name || '未命名账号' }}</strong><small v-if="account.selection_reason">{{ account.selection_reason }}</small></span><time>{{ formatTime(account.last_login_time) }}</time></label></li>
            </ul>
            <p v-else class="switching-inline-empty">本游戏暂无工具账号。登录账号后可在这里选择。</p>
          </template>
          <p v-else class="switching-scope-note">本游戏不再同步工具账号，已有选择仍会保留。</p>
          <p class="switching-scope-note">更改会自动保存，下次启动工具时应用。不会隐藏或删除游戏原生账号。</p>
          <p v-if="busy || feedback" :role="failed ? 'alert' : 'status'" :class="{ 'switching-validation': failed }" class="switching-scope-feedback">{{ busy ? '正在保存…' : feedback }}</p>
        </template>
      </div>
    </WinExpander>
  </section>
</template>

<style scoped>
.switching-current-game { padding: 20px 24px; }
.switching-game-toggle { display: flex; align-items: center; justify-content: space-between; gap: 24px; cursor: pointer; }
.switching-game-toggle strong, .switching-game-toggle small { display: block; }
.switching-game-toggle strong { font-size: 15px; font-weight: 600; }
.switching-game-toggle small, .switching-scope-note { color: var(--muted); font-size: 12px; line-height: 1.7; }
.switching-game-toggle small { margin-top: 6px; }
.switching-game-toggle .win-switch { flex-shrink: 0; }
.switching-scope-heading { display: flex; justify-content: space-between; gap: 16px; margin: 24px 0 10px; font-size: 13px; }
.switching-scope-heading strong, .switching-scope-accounts strong { font-weight: 500; }
.switching-scope-heading > span { color: var(--muted); }
.switching-scope-accounts { list-style: none; padding: 0; margin: 0; max-height: 270px; overflow: auto; }
.switching-scope-accounts li + li { border-top: 1px solid var(--line); }
.switching-scope-accounts label { display: flex; align-items: center; gap: 12px; padding: 12px 4px; cursor: pointer; }
.switching-scope-accounts label > span:not(.win-checkbox) { flex: 1; min-width: 0; overflow-wrap: anywhere; font-size: 13px; }
.switching-scope-accounts .win-checkbox { flex: 0 0 20px; }
.switching-scope-accounts small { display: block; margin-top: 4px; color: var(--muted); font-size: 12px; }
.switching-scope-accounts time { flex-shrink: 0; color: var(--muted); font-size: 12px; }
.switching-scope-note { margin: 14px 0 0; }
.switching-scope-feedback { font-size: 12px; margin: 12px 0 0; }
@media (max-width: 650px) { .switching-current-game { padding: 16px; } .switching-scope-accounts time { display: none; } }
</style>
