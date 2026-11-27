<script setup>
import StepTransition from './StepTransition.vue'
import WinSelect from './WinSelect.vue'
import { computed, ref } from 'vue'
import { ArrowLeft, ArrowRight, Check, CircleAlert, FolderOpen } from '@lucide/vue'
import { cmpGameId, gameTitle, useAppStore } from '../composables/useAppStore'
import { importErrorMessage, importProgressValue, importResultWarning, useGameImport } from '../composables/useGameImport'
import ModalShell from './ModalShell.vue'
import MotionProgressRing from './MotionProgressRing.vue'

const stepMoving = ref(false)
const app = useAppStore()
const importing = useGameImport()
const state = importing.state
const steps = ['选择', '确认', '结果']
const selectedGame = computed(() => app.state.games.find(game => cmpGameId(game.game_id, state.draft.game_id)))
const selectedTitle = computed(() => state.draft.display_name || gameTitle(selectedGame.value || {}, state.draft.game_id))
const selectedDistributionTitle = computed(() => importing.distributionTitle(state.draft.game_id, importing.selectedDistribution.value))
const distributionOptions = computed(() => importing.manualDistributions.value.map(item => ({
  value: String(item.distribution_id), label: importing.distributionTitle(state.draft.game_id, item.distribution_id),
})))
const taskTitle = computed(() => {
  if (state.task?.status !== 'done') return '导入状态未知'
  if (state.task.cancelled || state.task.phase === 'cancelled') return '已取消'
  return state.task.success === true ? '已导入' : '导入失败'
})
const progress = computed(() => importProgressValue(state.task))
const results = computed(() => state.task?.results?.length ? state.task.results : state.task?.status === 'done' && state.task.game_id ? [state.task] : [])
const dismissible = computed(() => !state.submitting && !state.picking && !state.controlling)
function selected(candidate) {
  return state.draft.source === 'fever' && cmpGameId(candidate.game_id, state.draft.game_id)
    && candidate.path === state.draft.path && String(candidate.distribution_id ?? -1) === String(state.draft.distribution_id)
}
function titleFor(result) {
  return gameTitle(app.state.games.find(game => cmpGameId(game.game_id, result.game_id)) || result, result.game_id)
}
function distributionFor(result) {
  return importing.distributionTitle(result.game_id, result.distribution_id)
}
function warningFor(result) {
  if (result.success) return importResultWarning(result)
  if (result.cancelled || state.task?.phase === 'cancelled') return ''
  return importErrorMessage(result.error || state.task?.error)
}
</script>

<template>
  <ModalShell :open="importing.supported.value && state.open" title="导入游戏" modal-class="account-switching-wizard game-import-wizard" :dismissible="dismissible" @close="importing.close">
    <ol v-if="state.task?.source !== 'startup' && !state.submitting && !importing.pending.value" class="switching-stepper" aria-label="导入步骤"><li v-for="(label, index) in steps" :key="label" :class="{ active: index === state.step, done: index < state.step }" :aria-current="index === state.step ? 'step' : undefined"><span><Check v-if="index < state.step" :size="12" /><template v-else>{{ index + 1 }}</template></span>{{ label }}</li></ol>
    <StepTransition @moving="stepMoving = $event" :step="state.step">
    <div v-if="state.loading || state.submitting" class="content-loading"><MotionProgressRing :size="32" :aria-label="state.submitting ? '正在导入' : '正在加载'" /></div>
    <section v-else-if="state.step === 0" class="switching-game-section">
      <h3>选择游戏</h3>
      <div class="game-import-sources" role="group" aria-label="导入来源">
        <button class="quiet-button" :class="{ selected: state.mode === 'manual' }" :aria-pressed="state.mode === 'manual'" :disabled="importing.busy.value" @click="importing.setMode('manual')">选择 EXE</button>
        <button class="quiet-button" :class="{ selected: state.mode === 'fever' }" :aria-pressed="state.mode === 'fever'" :disabled="importing.busy.value" @click="importing.setMode('fever')">发烧游戏平台</button>
      </div>
      <template v-if="state.mode === 'manual'">
        <label class="game-import-game-label" for="import-game-id">游戏</label>
        <WinSelect id="import-game-id" :model-value="state.draft.game_id" :disabled="importing.busy.value" :options="[{value: '', label: '请选择游戏', disabled: true}, ...app.state.games.map(game => ({value: game.game_id, label: gameTitle(game)}))]" @change="importing.setGame($event.target.value)" />
        <template v-if="distributionOptions.length > 1">
          <label class="game-import-game-label" for="import-distribution-id">游戏版本</label>
          <WinSelect id="import-distribution-id" :model-value="importing.selectedDistribution.value" placeholder="请选择游戏版本" :disabled="importing.busy.value" :options="distributionOptions" @update:model-value="importing.setDistribution" />
        </template>
        <div class="install-path-field" :class="{ empty: !state.draft.path }"><FolderOpen :size="16" /><span :title="state.draft.path">{{ state.draft.path || '选择游戏的 EXE 文件' }}</span><button class="inline-command" :disabled="importing.busy.value" @click="importing.chooseExecutable"><MotionProgressRing v-if="state.picking" :size="14" aria-label="正在选择文件" />{{ state.picking ? '正在选择' : state.draft.path ? '更改' : '选择' }}</button></div>
        <p class="switching-option-note">请选择此游戏的 EXE 文件。</p>
        <p v-if="!app.state.games.length" class="switching-validation">没有可选的游戏，请刷新后重试。</p>
      </template>
      <template v-else>
        <div v-if="!state.candidates.length" class="switching-inline-empty">没有可导入的游戏。您也可以选择 EXE 文件。</div>
        <div v-else class="switching-table-wrap game-import-candidates">
          <table class="switching-table" aria-label="发烧平台游戏记录"><thead><tr><th class="switching-check-cell" scope="col">选择</th><th scope="col">游戏与路径</th></tr></thead><tbody><tr v-for="(candidate, index) in state.candidates" :key="`${candidate.game_id}:${candidate.distribution_id}:${candidate.path}`" :class="{ selected: selected(candidate) }"><td class="switching-check-cell"><input :id="`import-candidate-${index}`" type="radio" name="import-candidate" :checked="selected(candidate)" :disabled="importing.busy.value" :aria-label="`选择${gameTitle(candidate)}`" @change="importing.selectCandidate(candidate)" /></td><td><label :for="`import-candidate-${index}`"><strong>{{ gameTitle(candidate) }}</strong><small v-if="distributionFor(candidate)">{{ distributionFor(candidate) }}</small><small>{{ candidate.path }}</small></label></td></tr></tbody></table>
        </div>
      </template>
      <p v-if="importing.pendingFor(state.draft.game_id, importing.selectedDistribution.value)" class="switching-option-note">此游戏版本正在导入。</p>
    </section>
    <section v-else-if="state.step === 1" class="switching-game-section">
      <h3>确认导入</h3>
      <dl class="game-import-summary"><dt>游戏</dt><dd>{{ selectedTitle }}</dd><template v-if="selectedDistributionTitle"><dt>游戏版本</dt><dd>{{ selectedDistributionTitle }}</dd></template><dt>来源</dt><dd>{{ state.draft.source === 'fever' ? '发烧游戏平台' : '选择 EXE' }}</dd><dt>路径</dt><dd>{{ state.draft.path }}</dd></dl>
    </section>
    <section v-else class="switching-game-section" aria-live="polite">
      <div v-if="importing.pending.value && state.polling" class="content-loading">
        <MotionProgressRing :size="32" :value="progress" :aria-label="state.task.cancel_requested ? '正在取消' : '正在导入'" />
      </div>
      <template v-else>
        <div class="game-import-status"><Check v-if="state.task?.success === true" :size="26" aria-hidden="true" /><CircleAlert v-else :size="26" aria-hidden="true" /><h3>{{ taskTitle }}</h3></div>
        <template v-if="results.length === 1">
          <p v-if="importing.resultCorrection(results[0])" class="switching-option-note">{{ importing.resultCorrection(results[0]) }}</p>
          <p v-if="warningFor(results[0])" class="switching-validation" role="alert">{{ warningFor(results[0]) }}</p>
        </template>
        <div v-else-if="results.length > 1" class="switching-table-wrap game-import-results">
          <table class="switching-table" aria-label="导入结果"><thead><tr><th scope="col">游戏</th><th scope="col">结果</th></tr></thead><tbody>
            <tr v-for="(result, index) in results" :key="`${result.game_id}:${result.installation_id || index}`">
              <td>{{ titleFor(result) }}</td>
              <td>{{ result.success === true ? '已导入' : result.cancelled ? '已取消' : '导入失败' }}
                <small v-if="importing.resultCorrection(result)">{{ importing.resultCorrection(result) }}</small>
                <small v-if="warningFor(result)">{{ warningFor(result) }}</small>
              </td>
            </tr>
          </tbody></table>
        </div>
        <p v-else-if="state.task?.error && !state.task.cancelled && state.task.phase !== 'cancelled'" class="switching-validation" role="alert">{{ importErrorMessage(state.task.error) }}</p>
        <button v-if="state.uncertain || importing.pending.value" class="quiet-button" :disabled="importing.busy.value" @click="importing.retryStatus">刷新</button>
      </template>
    </section>
    </StepTransition>
    <p v-if="state.error" class="switching-validation" role="alert">{{ state.error }}</p>
    <button v-if="state.error && state.step < 2" class="text-button" :disabled="importing.busy.value" @click="importing.refreshSources">重试</button>
    <template #footer>
      <div class="switching-footer-actions">
        <template v-if="state.step < 2"><button v-if="state.step === 0" class="quiet-button" :disabled="!dismissible" @click="importing.close">稍后再说</button><button v-else class="quiet-button" :disabled="stepMoving || importing.busy.value" @click="importing.back"><ArrowLeft :size="15" />上一步</button><button v-if="state.step === 0" class="primary" :disabled="stepMoving || !importing.canConfirm.value" @click="importing.next">下一步<ArrowRight :size="15" /></button><button v-else class="primary" :disabled="stepMoving || !importing.canConfirm.value" @click="importing.submit">导入游戏</button></template>
        <template v-else><button v-if="importing.pending.value && state.task?.cancelable && !state.task.cancel_requested" class="quiet-button" :disabled="stepMoving || importing.busy.value" @click="importing.cancel">取消导入</button><button v-if="state.task?.status === 'done'" class="quiet-button" :disabled="stepMoving || importing.busy.value" @click="importing.continueImport">继续导入</button><button class="primary" :disabled="!dismissible" @click="importing.close">{{ state.task?.status === 'done' ? '完成' : '关闭' }}</button></template>
      </div>
    </template>
  </ModalShell>
</template>
