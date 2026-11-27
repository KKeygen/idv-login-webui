<script setup>
import StepTransition from './StepTransition.vue'
import WinSelect from './WinSelect.vue'
import { computed, ref } from 'vue'
import { ArrowLeft, ArrowRight, Check, FolderOpen } from '@lucide/vue'
import { cmpGameId, gameTitle, useAppStore } from '../composables/useAppStore'
import { useGameImport } from '../composables/useGameImport'
import ModalShell from './ModalShell.vue'
import MotionProgressRing from './MotionProgressRing.vue'

const stepMoving = ref(false)
const app = useAppStore()
const importing = useGameImport()
const state = importing.state
const steps = ['选择', '确认']
const selectedGame = computed(() => app.state.games.find(game => cmpGameId(game.game_id, state.draft.game_id)))
const selectedTitle = computed(() => state.draft.display_name || gameTitle(selectedGame.value || {}, state.draft.game_id))
const selectedDistributionTitle = computed(() => importing.distributionTitle(state.draft.game_id, importing.selectedDistribution.value))
const distributionOptions = computed(() => importing.manualDistributions.value.map(item => ({
  value: String(item.distribution_id), label: importing.distributionTitle(state.draft.game_id, item.distribution_id),
})))
const dismissible = computed(() => !state.submitting && !state.picking && !state.controlling)
function selected(candidate) {
  return state.draft.source === 'fever' && cmpGameId(candidate.game_id, state.draft.game_id)
    && candidate.path === state.draft.path && String(candidate.distribution_id ?? -1) === String(state.draft.distribution_id)
}
function distributionFor(result) {
  return importing.distributionTitle(result.game_id, result.distribution_id)
}
</script>

<template>
  <ModalShell :open="importing.supported.value && state.open" title="导入游戏" modal-class="game-import-wizard account-switching-wizard" :dismissible="dismissible" @close="importing.close">
    <ol class="switching-stepper" aria-label="导入步骤"><li v-for="(label, index) in steps" :key="label" :class="{ active: index === state.step, done: index < state.step }" :aria-current="index === state.step ? 'step' : undefined"><span><Check v-if="index < state.step" :size="12" /><template v-else>{{ index + 1 }}</template></span>{{ label }}</li></ol>
    <StepTransition @moving="stepMoving = $event" :step="state.step">
    <div v-if="state.step === 0 && state.loading" class="content-loading"><MotionProgressRing :size="32" aria-label="正在加载" /></div>
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
    <section v-else class="switching-game-section">
      <h3>确认导入</h3>
      <dl class="game-import-summary"><dt>游戏</dt><dd>{{ selectedTitle }}</dd><template v-if="selectedDistributionTitle"><dt>游戏版本</dt><dd>{{ selectedDistributionTitle }}</dd></template><dt>来源</dt><dd>{{ state.draft.source === 'fever' ? '发烧游戏平台' : '选择 EXE' }}</dd><dt>路径</dt><dd>{{ state.draft.path }}</dd></dl>
    </section>
    </StepTransition>
    <p v-if="state.error" class="switching-validation" role="alert">{{ state.error }}</p>
    <button v-if="state.error && state.step === 0" class="text-button" :disabled="importing.busy.value" @click="importing.refreshSources">重试</button>
    <template #footer>
      <div class="switching-footer-actions">
        <template v-if="state.step === 0">
          <button class="quiet-button" :disabled="!dismissible" @click="importing.close">稍后再说</button>
          <button class="primary" :disabled="stepMoving || !importing.canConfirm.value" @click="importing.next">下一步<ArrowRight :size="15" /></button>
        </template>
        <template v-else>
          <button class="quiet-button" :disabled="stepMoving || importing.busy.value || state.uncertain" @click="importing.back"><ArrowLeft :size="15" />上一步</button>
          <button v-if="state.uncertain" class="primary" :disabled="importing.busy.value" @click="importing.recoverSubmission">查找导入</button>
          <button v-else class="primary" :disabled="stepMoving || !importing.canConfirm.value" @click="importing.submit">开始导入</button>
        </template>
      </div>
    </template>
  </ModalShell>
</template>
