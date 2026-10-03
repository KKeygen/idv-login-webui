<script setup>
import { computed, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, Check, ChevronDown, UserRound, CircleX, QrCode, Gamepad2, MousePointer2 } from '@lucide/vue'
import { createSwitchingDraft, validateSwitchingDraft } from '../accountSwitching'
import { useAccountSwitching } from '../composables/useAccountSwitching'
import { useAppStore } from '../composables/useAppStore'
import ModalShell from './ModalShell.vue'
import MotionProgressRing from './MotionProgressRing.vue'
import AccountSwitchingFields from './AccountSwitchingFields.vue'
import MaskedGameLogo from './MaskedGameLogo.vue'

const app = useAppStore()
const switching = useAccountSwitching()
const step = ref(0)
const draft = ref(createSwitchingDraft())
const steps = ['功能介绍', '选择游戏', '账号与偏好', '更多说明']
const selectedCount = computed(() => switching.state.games.filter(game => draft.value.games[game.local_game_id]?.enabled).length)
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
  if (await switching.save(config)) {
    switching.closeAfterSave()
    app.notify('游戏内账号切换已开启，之后可在账号管理的齿轮中调整', 'success')
  }
}
function next() {
  if (!ready.value || (step.value === 1 && !selectedCount.value) || validation.value) return
  step.value += 1
}
</script>

<template>
  <ModalShell :open="switching.supported.value && switching.state.open" title="新功能：游戏内切换渠道服账号向导" modal-class="account-switching-wizard" :dismissible="!switching.state.saving" @close="switching.dismiss">
    <div v-if="switching.state.loading" class="content-loading"><MotionProgressRing :size="32" aria-label="正在读取已安装游戏" /><span>正在读取已安装游戏和账号…</span></div>
    <div v-else-if="!switching.state.loaded" class="switching-load-error" role="alert"><p>{{ switching.state.error || '暂时无法读取账号切换设置' }}</p><button class="quiet-button" @click="switching.load({ force: true })">重新读取</button></div>
    <template v-else>
      <ol class="switching-stepper" aria-label="配置步骤"><li v-for="(label, index) in steps" :key="label" :class="{ active: index === step, done: index < step }" :aria-current="index === step ? 'step' : undefined"><span><Check v-if="index < step" :size="12" /><template v-else>{{ index + 1 }}</template></span>{{ label }}</li></ol>
      <div v-if="step === 0" class="switching-intro">
        <p class="switching-lead">常用账号，在游戏内直接选</p>
        <div class="switching-comparison" aria-label="现在在扫码界面点击游戏图标切换；开启后直接在游戏账号列表中选择">
          <div class="switching-illustration before">
            <div class="switching-illustration-title">现在：在扫码界面点击游戏图标切换</div>
            <div class="switching-mini-native switching-mini-scan">
              <MaskedGameLogo />
              <QrCode class="switching-scan-code" :size="72" :stroke-width="1.4" aria-hidden="true" />
              <div class="switching-scan-game"><span class="switching-scan-game-icon"><Gamepad2 :size="20" /></span><span>游戏图标</span><MousePointer2 class="switching-scan-pointer" :size="24" /></div>
            </div>
          </div>
          <ArrowRight class="switching-comparison-arrow" :size="20" />
          <div class="switching-illustration after">
            <div class="switching-illustration-title">开启后：在游戏内直接选择账号</div>
            <div class="switching-mini-native">
              <MaskedGameLogo />
              <div class="switching-native-selected"><UserRound :size="16" /><span>常用账号</span><ChevronDown :size="13" /></div>
              <div class="switching-native-dropdown">
                <div><span class="switching-native-dot" /><span>常用账号</span><CircleX :size="11" /></div>
                <div><span class="switching-native-dot alternate" /><span>另一个账号</span><CircleX :size="11" /></div>
                <div class="switching-native-other">使用其他账号登录</div>
              </div>
            </div>
          </div>
        </div>
        <h3 class="switching-question">您是否要配置游戏内切换渠道服账号？</h3>
      </div>
      <section v-else-if="step === 1" class="switching-game-section">
        <h3>选择游戏</h3>
        <div v-if="!switching.state.games.length" class="switching-inline-empty">还没有已安装的游戏。安装后，可从应用设置重新打开向导。</div>
        <div v-else class="switching-table-wrap">
          <table class="switching-table switching-game-table" aria-label="选择已安装游戏及其账号数量">
            <thead><tr><th class="switching-check-cell" scope="col">选择</th><th scope="col">游戏 / 本地安装</th><th class="switching-count-cell" scope="col">工具账号</th><th class="switching-count-cell" scope="col">原生账号</th></tr></thead>
            <tbody>
              <tr v-for="game in switching.state.games" :key="game.local_game_id" :class="{ selected: draft.games[game.local_game_id]?.enabled }">
                <td class="switching-check-cell"><input :id="`switching-game-${game.local_game_id}`" v-model="draft.games[game.local_game_id].enabled" type="checkbox" :aria-label="`选择${game.name || game.short_game_id} ${game.installation_label || '本地安装'}`" :disabled="switching.state.saving" /></td>
                <td><label :for="`switching-game-${game.local_game_id}`" class="switching-table-game-label"><strong>{{ game.name || game.short_game_id }} <span class="switching-short-id">{{ game.short_game_id }}</span></strong><small>{{ game.installation_label || '本地安装' }}</small></label></td>
                <td class="switching-count-cell">{{ game.tool_account_count ?? game.accounts.length }}</td><td class="switching-count-cell">{{ game.native_account_count ?? '未知' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <AccountSwitchingFields v-else :draft="draft" :games="switching.state.games" :section="step === 2 ? 'selection' : 'info'" :disabled="switching.state.saving" />
      <p v-if="validation" class="switching-validation" role="alert">{{ validation }}</p>
      <p v-if="switching.state.error" class="switching-validation" role="alert">{{ switching.state.error }}</p>
    </template>
    <template #footer>
      <span v-if="switching.state.saving" class="switching-footer-note" role="status">正在保存，请稍候…</span>
      <div class="switching-footer-actions"><button v-if="step === 0" class="quiet-button" :disabled="switching.state.saving" @click="switching.dismiss">不感兴趣</button><button v-else class="quiet-button" :disabled="!ready" @click="step -= 1"><ArrowLeft :size="15" />上一步</button><button v-if="step < 3" class="primary" :disabled="!ready || (step === 1 && !selectedCount) || Boolean(validation)" @click="next">下一步<ArrowRight :size="15" /></button><button v-else class="primary" :disabled="!ready" @click="finish"><MotionProgressRing v-if="switching.state.saving" :size="16" />完成并开启</button></div>
    </template>
  </ModalShell>
</template>
