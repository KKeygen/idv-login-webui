<script setup>
import { computed, onDeactivated, ref, watch } from 'vue'
import { Settings, ChevronDown } from '@lucide/vue'
import { createSwitchingDraft, validateSwitchingDraft } from '../accountSwitching'
import { useAccountSwitching } from '../composables/useAccountSwitching'
import { useAppStore } from '../composables/useAppStore'
import AccountSwitchingFields from './AccountSwitchingFields.vue'
import MotionProgressRing from './MotionProgressRing.vue'

const app = useAppStore()
const switching = useAccountSwitching()
const expanded = ref(false)
const draft = ref(createSwitchingDraft())
const validation = computed(() => validateSwitchingDraft(draft.value, switching.state.games))
let editGeneration = 0
async function toggle() {
  if (switching.state.saving) return
  expanded.value = !expanded.value
  if (!expanded.value) { editGeneration += 1; return }
  await reload()
}
async function reload() {
  const generation = ++editGeneration
  const data = await switching.load({ force: true })
  if (data && generation === editGeneration && expanded.value) draft.value = createSwitchingDraft(data.config, data.games)
}
async function save() {
  if (validation.value || switching.state.loading || switching.state.saving) return
  if (await switching.save({ ...draft.value, onboarding_completed: true })) app.notify('游戏内账号切换设置已保存', 'success')
}
watch(() => switching.state.config, config => {
  if (expanded.value && !switching.state.loading) draft.value = createSwitchingDraft(config, switching.state.games)
})
onDeactivated(() => { expanded.value = false; editGeneration += 1 })
</script>

<template>
  <section v-if="switching.supported.value" class="switching-settings">
    <button class="quiet-button switching-settings-toggle" type="button" :aria-expanded="expanded" aria-controls="account-switching-settings" :disabled="switching.state.saving" @click="toggle"><Settings :size="17" /><span>游戏内账号切换设置</span><ChevronDown :size="16" :class="{ rotated: expanded }" /></button>
    <div v-if="expanded" id="account-switching-settings" class="switching-settings-body">
      <div v-if="switching.state.loading" class="content-loading"><MotionProgressRing :size="24" aria-label="正在读取账号切换设置" /><span>正在读取设置…</span></div>
      <div v-else-if="!switching.state.loaded" class="switching-load-error"><p>{{ switching.state.error }}</p><button class="quiet-button" @click="reload">重新读取</button></div>
      <template v-else>
        <label class="switching-option"><input v-model="draft.enabled" type="checkbox" :disabled="switching.state.saving" /><span><strong>启用游戏内切换渠道服账号</strong><small>暂时关闭后仍保留您的游戏和账号选择。</small></span></label>
        <button class="text-button switching-reconfigure" :disabled="switching.state.saving" @click="switching.openWizard">重新选择游戏 / 打开向导</button>
        <AccountSwitchingFields :draft="draft" :games="switching.state.games" :disabled="switching.state.saving" />
        <p v-if="validation" class="switching-validation" role="alert">{{ validation }}</p>
        <p v-if="switching.state.error" class="switching-validation" role="alert">{{ switching.state.error }}</p>
        <div class="switching-settings-actions"><span v-if="switching.state.saving" role="status">正在保存，请等待账号更新完成…</span><button class="primary" :disabled="switching.state.saving || Boolean(validation)" @click="save"><MotionProgressRing v-if="switching.state.saving" :size="16" />保存设置</button></div>
      </template>
    </div>
  </section>
</template>
