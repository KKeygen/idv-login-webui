<script setup>
import { computed, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, Check, ChevronDown, UserRound, CircleX, QrCode, Smartphone, Mail, Gamepad2, MousePointer2 } from '@lucide/vue'
import { ACCOUNT_SWITCHING_GAME_HELP, createSwitchingDraft, validateSwitchingDraft } from '../accountSwitching'
import { openExternal, request } from '../api'
import { showConfirm } from '../dialogService'
import { useAccountSwitching } from '../composables/useAccountSwitching'
import { gameTitle, useAppStore } from '../composables/useAppStore'
import ModalShell from './ModalShell.vue'
import MotionProgressRing from './MotionProgressRing.vue'
import AccountSwitchingFields from './AccountSwitchingFields.vue'
import MaskedGameLogo from './MaskedGameLogo.vue'

const app = useAppStore()
const switching = useAccountSwitching()
const step = ref(0)
const draft = ref(createSwitchingDraft())
const steps = ['功能介绍', '选择游戏', '账号与偏好', '更多说明']
const selectedCount = computed(() => switching.state.games.filter(game => draft.value.games[game.short_game_id]?.enabled).length)
const validation = computed(() => step.value === 2 ? validateSwitchingDraft({ ...draft.value, enabled: false }, switching.state.games) : '')
const ready = computed(() => switching.state.loaded && !switching.state.loading && !switching.state.saving)
let draftInitialized = false
watch(() => switching.state.open, open => {
  if (!open) return
  // A new visit starts at the introduction; loading/saving never resets a step.
  step.value = 0
  draftInitialized = false
}, { flush: 'sync' })
watch(() => [switching.state.open, switching.state.loading, switching.state.loaded], ([open, loading, loaded]) => {
  if (!open || loading || !loaded || draftInitialized) return
  draft.value = createSwitchingDraft(switching.state.config, switching.state.games)
  draftInitialized = true
}, { immediate: true })
async function finish() {
  if (!ready.value) return
  const config = { ...draft.value, enabled: true, onboarding_completed: true }
  const error = validateSwitchingDraft(config, switching.state.games)
  if (error) return app.notify(error, 'warning')
  if (!await switching.save(config)) return
  switching.closeAfterSave()
  const restart = await showConfirm('设置已保存。您需要重启工具才能使此修改生效', {
    title: '重启工具', confirmText: '立即重启', cancelText: '稍后重启',
  })
  if (!restart) return
  try {
    const result = await request('/restart', { method: 'POST' })
    if (result?.success !== true) throw new Error('Restart not confirmed')
    app.notify('已发起工具重启，请稍候')
  } catch {
    app.notify('设置已保存，但未能确认重启结果。请检查工具是否已经重启；若仍在运行，可正常退出后重新打开', 'warning')
  }
}
function next() {
  if (!ready.value || (step.value === 1 && !selectedCount.value) || validation.value) return
  step.value += 1
}
</script>

<template>
  <ModalShell :open="switching.supported.value && switching.state.open" title="新功能：游戏内切换渠道服账号向导" modal-class="account-switching-wizard" :dismissible="!switching.state.saving" @close="switching.dismiss">
    <div v-if="switching.state.loading" class="content-loading"><MotionProgressRing :size="32" aria-label="正在读取游戏" /><span>正在读取游戏和账号…</span></div>
    <div v-else-if="!switching.state.loaded" class="switching-load-error" role="alert"><p>{{ switching.state.error || '暂时无法读取账号切换设置' }}</p><button class="quiet-button" @click="switching.load({ force: true })">重新读取</button></div>
    <template v-else>
      <ol class="switching-stepper" aria-label="配置步骤"><li v-for="(label, index) in steps" :key="label" :class="{ active: index === step, done: index < step }" :aria-current="index === step ? 'step' : undefined"><span><Check v-if="index < step" :size="12" /><template v-else>{{ index + 1 }}</template></span>{{ label }}</li></ol>
      <div v-if="step === 0" class="switching-intro">
        <p class="switching-lead">常用账号，在游戏内直接选</p>
        <div class="switching-comparison" aria-label="现在在扫码界面点击游戏图标切换；开启后直接在游戏账号列表中选择">
          <div class="switching-illustration before">
            <div class="switching-illustration-title">现在：在扫码界面点击游戏图标切换</div>
            <div class="switching-mini-native">
              <MaskedGameLogo />
              <div class="switching-native-selected"><span class="switching-native-dot phone"><Smartphone :size="10" /></span><span>138****0000</span><ChevronDown :size="13" /></div>
              <div class="switching-native-dropdown">
                <div><span class="switching-native-dot phone"><Smartphone :size="10" /></span><span>138****0000</span><CircleX :size="11" /></div>
                <div><span class="switching-native-dot scan"><QrCode :size="10" /></span><span>扫码登录</span><CircleX :size="11" /></div>
                <div><span class="switching-native-dot email"><Mail :size="10" /></span><span>player@example.com</span><CircleX :size="11" /></div>
                <div class="switching-native-other">使用其他账号登录</div>
              </div>
              <div class="switching-scan-game"><span class="switching-scan-game-icon"><Gamepad2 :size="20" /></span><span>游戏图标</span><MousePointer2 class="switching-scan-pointer" :size="24" /></div>
            </div>
          </div>
          <ArrowRight class="switching-comparison-arrow" :size="20" />
          <div class="switching-illustration after">
            <div class="switching-illustration-title">开启后：在游戏内直接选择账号</div>
            <div class="switching-mini-native">
              <MaskedGameLogo />
              <div class="switching-native-selected"><span class="switching-native-dot channel"><UserRound :size="11" /></span><span>小米账号</span><small>渠道服</small><ChevronDown :size="13" /></div>
              <div class="switching-native-dropdown">
                <div><span class="switching-native-dot channel"><UserRound :size="11" /></span><span>小米账号</span><small>渠道服</small><CircleX :size="11" /></div>
                <div><span class="switching-native-dot phone"><Smartphone :size="10" /></span><span>138****0000</span><small>官服</small><CircleX :size="11" /></div>
                <div><span class="switching-native-dot scan"><QrCode :size="10" /></span><span>扫码登录</span><small>官服</small><CircleX :size="11" /></div>
                <div class="switching-native-other">使用其他账号登录</div>
              </div>
            </div>
          </div>
        </div>
        <h3 class="switching-question">您是否要配置游戏内切换渠道服账号？</h3>
      </div>
      <section v-else-if="step === 1" class="switching-game-section">
        <h3>选择游戏</h3>
        <p class="switching-option-note">同一游戏的多个安装共用账号选择。</p>
        <div v-if="!switching.state.games.length" class="switching-inline-empty">还没有已登记的游戏。</div>
        <div v-else class="switching-table-wrap">
          <table class="switching-table switching-game-table" aria-label="选择游戏及其账号数量">
            <thead><tr><th class="switching-check-cell" scope="col">选择</th><th scope="col">游戏</th><th class="switching-count-cell" scope="col">工具账号</th><th class="switching-count-cell" scope="col">原生账号</th></tr></thead>
            <tbody>
              <tr v-for="game in switching.state.games" :key="game.short_game_id" :class="{ selected: draft.games[game.short_game_id]?.enabled }">
                <td class="switching-check-cell"><input :id="`switching-game-${game.short_game_id}`" v-model="draft.games[game.short_game_id].enabled" type="checkbox" :aria-label="`选择${gameTitle(game)}`" :disabled="switching.state.saving" /></td>
                <td><label :for="`switching-game-${game.short_game_id}`" class="switching-table-game-label"><strong>{{ gameTitle(game) }} <span v-if="game.name && game.name !== game.game_id && game.name !== game.short_game_id" class="switching-short-id">{{ game.short_game_id }}</span></strong></label></td>
                <td class="switching-count-cell">{{ game.tool_account_count ?? game.accounts.length }}</td><td class="switching-count-cell">{{ game.native_account_count ?? '未知' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="switching-option-note switching-game-help"><button class="text-button" @click="openExternal(ACCOUNT_SWITCHING_GAME_HELP)">找不到我的游戏？</button>请从游戏登录二维码下方的游戏图标进入渠道服账号管理一次，然后重新打开向导。</p>
      </section>
      <AccountSwitchingFields v-else :draft="draft" :games="switching.state.games" :section="step === 2 ? 'selection' : 'info'" :disabled="switching.state.saving" />
      <p v-if="step === 3" class="switching-option-note">您需要重启工具才能使此修改生效</p>
      <p v-if="validation" class="switching-validation" role="alert">{{ validation }}</p>
      <p v-if="switching.state.error" class="switching-validation" role="alert">{{ switching.state.error }}</p>
    </template>
    <template #footer>
      <span v-if="switching.state.saving" class="switching-footer-note" role="status">正在保存设置…</span>
      <div class="switching-footer-actions"><button v-if="step === 0" class="quiet-button" :disabled="switching.state.saving" @click="switching.dismiss">不感兴趣</button><button v-else class="quiet-button" :disabled="!ready" @click="step -= 1"><ArrowLeft :size="15" />上一步</button><button v-if="step < 3" class="primary" :disabled="!ready || (step === 1 && !selectedCount) || Boolean(validation)" @click="next">下一步<ArrowRight :size="15" /></button><button v-else class="primary" :disabled="!ready" @click="finish"><MotionProgressRing v-if="switching.state.saving" :size="16" />完成并开启</button></div>
    </template>
  </ModalShell>
</template>
