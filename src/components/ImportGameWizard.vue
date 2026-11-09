<script setup>
import StepTransition from './StepTransition.vue'
import WinSelect from './WinSelect.vue'
import { computed, ref } from 'vue'
import { ArrowLeft, ArrowRight, Check, CircleAlert, FolderOpen } from '@lucide/vue'
import { cmpGameId, gameTitle, useAppStore } from '../composables/useAppStore'
import { useGameImport } from '../composables/useGameImport'
import ModalShell from './ModalShell.vue'
import MotionProgressRing from './MotionProgressRing.vue'

const stepMoving = ref(false)
const app = useAppStore()
const importing = useGameImport()
const state = importing.state
const steps = ['选择来源', '确认导入', '进度与结果']
const phaseLabels = { preparing: '正在准备导入', checking: '正在校验游戏文件', saving: '正在保存安装记录', finished: '导入已完成', failed: '导入未完成', cancelled: '导入已取消' }
const selectedGame = computed(() => app.state.games.find(game => cmpGameId(game.game_id, state.draft.game_id)))
const selectedTitle = computed(() => state.draft.display_name || gameTitle(selectedGame.value || {}, state.draft.game_id))
const taskTitle = computed(() => {
  if (state.uncertain) return '正在确认后台是否已接收请求'
  if (state.task?.status === 'done') {
    if (state.task.cancelled || state.task.phase === 'cancelled') return '导入已取消'
    return state.task.success === true ? '导入已完成' : '导入未完成'
  }
  return phaseLabels[state.task?.phase] || '正在后台处理'
})
const progress = computed(() => {
  const value = state.task?.progress_percent
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : Number.NaN
})
const results = computed(() => state.task?.results?.length ? state.task.results : state.task?.status === 'done' && state.task.game_id ? [state.task] : [])
const dismissible = computed(() => !state.submitting && !state.picking && !state.controlling)
function selected(candidate) {
  return state.draft.source === 'fever' && cmpGameId(candidate.game_id, state.draft.game_id)
    && candidate.path === state.draft.path && String(candidate.distribution_id ?? -1) === String(state.draft.distribution_id)
}
function titleFor(result) {
  return gameTitle(app.state.games.find(game => cmpGameId(game.game_id, result.game_id)) || result, result.game_id)
}
</script>

<template>
  <ModalShell :open="importing.supported.value && state.open" title="导入游戏向导" modal-class="account-switching-wizard game-import-wizard" :dismissible="dismissible" @close="importing.close">
    <ol v-if="state.task?.source !== 'startup'" class="switching-stepper" aria-label="导入步骤"><li v-for="(label, index) in steps" :key="label" :class="{ active: index === state.step, done: index < state.step }" :aria-current="index === state.step ? 'step' : undefined"><span><Check v-if="index < state.step" :size="12" /><template v-else>{{ index + 1 }}</template></span>{{ label }}</li></ol>
    <StepTransition @moving="stepMoving = $event" :step="state.step">
    <div v-if="state.loading" class="content-loading"><MotionProgressRing :size="32" aria-label="正在读取导入状态" /><span>正在读取可导入的游戏与后台任务…</span></div>
    <section v-else-if="state.step === 0" class="switching-game-section">
      <h3>选择已安装的游戏</h3>
      <div class="game-import-sources" role="group" aria-label="导入来源">
        <button class="quiet-button" :class="{ selected: state.mode === 'manual' }" :aria-pressed="state.mode === 'manual'" :disabled="importing.busy.value" @click="importing.setMode('manual')">手动选择 EXE</button>
        <button class="quiet-button" :class="{ selected: state.mode === 'fever' }" :aria-pressed="state.mode === 'fever'" :disabled="importing.busy.value" @click="importing.setMode('fever')">从发烧游戏平台导入</button>
      </div>
      <template v-if="state.mode === 'manual'">
        <label class="game-import-game-label" for="import-game-id">对应游戏</label>
        <WinSelect id="import-game-id" :model-value="state.draft.game_id" :disabled="importing.busy.value" :options="[{value: '', label: '请选择对应游戏', disabled: true}, ...app.state.games.map(game => ({value: game.game_id, label: gameTitle(game)}))]" @change="importing.setGame($event.target.value)" />
        <div class="install-path-field" :class="{ empty: !state.draft.path }"><FolderOpen :size="16" /><span :title="state.draft.path">{{ state.draft.path || '选择游戏的 EXE 启动程序' }}</span><button class="inline-command" :disabled="importing.busy.value" @click="importing.chooseExecutable"><MotionProgressRing v-if="state.picking" :size="14" />{{ state.picking ? '正在选择' : state.draft.path ? '更改' : '选择' }}</button></div>
        <p class="switching-option-note">仅支持 EXE，不支持快捷方式或文件夹。请选择与上方游戏对应的启动程序。</p>
        <p v-if="!app.state.games.length" class="switching-validation">暂时没有可选择的游戏，请确认游戏列表已成功加载。</p>
      </template>
      <template v-else>
        <p class="switching-option-note">请选择要导入的发烧游戏平台记录；不会自动选择其他游戏。</p>
        <div v-if="!state.candidates.length" class="switching-inline-empty">没有找到可导入的发烧游戏平台记录。</div>
        <div v-else class="switching-table-wrap game-import-candidates">
          <table class="switching-table" aria-label="发烧平台游戏记录"><thead><tr><th class="switching-check-cell" scope="col">选择</th><th scope="col">游戏与路径</th></tr></thead><tbody><tr v-for="(candidate, index) in state.candidates" :key="`${candidate.game_id}:${candidate.distribution_id}:${candidate.path}`" :class="{ selected: selected(candidate) }"><td class="switching-check-cell"><input :id="`import-candidate-${index}`" type="radio" name="import-candidate" :checked="selected(candidate)" :disabled="importing.busy.value" :aria-label="`选择${gameTitle(candidate)}`" @change="importing.selectCandidate(candidate)" /></td><td><label :for="`import-candidate-${index}`"><strong>{{ gameTitle(candidate) }}</strong><small>{{ candidate.path }}</small></label></td></tr></tbody></table>
        </div>
      </template>
    </section>
    <section v-else-if="state.step === 1" class="switching-game-section">
      <h3>确认导入信息</h3>
      <dl class="game-import-summary"><dt>游戏</dt><dd>{{ selectedTitle }}</dd><dt>来源</dt><dd>{{ state.draft.source === 'fever' ? '发烧游戏平台' : '手动选择 EXE' }}</dd><dt>路径</dt><dd>{{ state.draft.path }}</dd></dl>
      <p class="switching-option-note">确认后将由工具在后台校验文件并保存安装记录。关闭向导不会停止已开始的导入。</p>
    </section>
    <section v-else class="switching-game-section" aria-live="polite">
      <p v-if="state.task?.source === 'startup'" class="switching-option-note">工具启动时已自动开始导入，您可以在这里查看进度与结果。</p>
      <div class="game-import-status"><MotionProgressRing v-if="importing.pending.value && state.polling" :size="26" :value="progress" /><Check v-else-if="state.task?.success === true" :size="26" /><CircleAlert v-else :size="26" /><h3>{{ taskTitle }}</h3></div>
      <p v-if="importing.pending.value" class="switching-option-note">校验可能需要一些时间。可以关闭向导，稍后通过游戏库中的“导入已安装游戏”继续查看。</p>
      <p v-if="importing.pending.value && state.task?.total_files > 0" class="switching-option-note">已检查 {{ state.task.completed_files ?? 0 }} / {{ state.task.total_files }} 个文件</p>
      <p v-if="state.task?.cancel_requested" class="switching-option-note">已请求取消，正在等待后台确认。</p>
      <p v-if="state.task?.error" class="switching-validation" role="alert">{{ state.task.error }}</p>
      <dl v-if="state.task?.path || state.uncertain" class="game-import-summary"><dt>路径</dt><dd>{{ state.task?.path || state.draft.path }}</dd></dl>
      <div v-if="results.length" class="switching-table-wrap game-import-results">
        <table class="switching-table" aria-label="导入结果"><thead><tr><th scope="col">游戏</th><th scope="col">结果</th></tr></thead><tbody><tr v-for="(result, index) in results" :key="`${result.game_id}:${result.installation_id || index}`"><td>{{ titleFor(result) }}<small v-if="result.path">{{ result.path }}</small></td><td>{{ result.success === true ? '已导入' : result.cancelled ? '已取消' : '未导入' }}<small v-if="result.version">已确认版本：{{ result.version }}</small><small v-if="result.error">{{ result.error }}</small></td></tr></tbody></table>
      </div>
      <button v-if="state.uncertain || (importing.pending.value && !state.polling)" class="quiet-button" :disabled="importing.busy.value" @click="importing.retryStatus">重新读取任务状态</button>
    </section>
    </StepTransition>
    <p v-if="state.error" class="switching-validation" role="alert">{{ state.error }}</p>
    <button v-if="state.error && state.step < 2" class="text-button" :disabled="importing.busy.value" @click="importing.readState">重新读取导入来源</button>
    <template #footer>
      <span v-if="state.submitting" class="switching-footer-note" role="status">正在发起后台导入…</span>
      <div class="switching-footer-actions">
        <template v-if="state.step < 2"><button v-if="state.step === 0" class="quiet-button" :disabled="!dismissible" @click="importing.close">稍后再说</button><button v-else class="quiet-button" :disabled="stepMoving || importing.busy.value" @click="importing.back"><ArrowLeft :size="15" />上一步</button><button v-if="state.step === 0" class="primary" :disabled="stepMoving || !importing.canConfirm.value" @click="importing.next">下一步<ArrowRight :size="15" /></button><button v-else class="primary" :disabled="stepMoving || !importing.canConfirm.value" @click="importing.submit"><MotionProgressRing v-if="state.submitting" :size="16" />开始导入</button></template>
        <template v-else><button v-if="importing.pending.value && state.task?.cancelable && !state.task.cancel_requested" class="quiet-button" :disabled="stepMoving || importing.busy.value" @click="importing.cancel">取消导入</button><button v-if="state.task?.status === 'done'" class="quiet-button" :disabled="stepMoving || importing.busy.value" @click="importing.continueImport">继续导入其他游戏</button><button class="primary" :disabled="!dismissible" @click="importing.close">{{ importing.pending.value ? '后台继续' : state.uncertain ? '关闭' : '完成' }}</button></template>
      </div>
    </template>
  </ModalShell>
</template>
