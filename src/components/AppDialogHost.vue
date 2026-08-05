<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { CircleAlert, MessageSquareText, PencilLine } from '@lucide/vue'
import { cancelDialog, dialogState, settleDialog } from '../dialogService'
import ModalShell from './ModalShell.vue'

const draft = ref('')
const input = ref(null)
const primaryButton = ref(null)
const current = computed(() => dialogState.current)
const icon = computed(() => current.value?.kind === 'prompt' ? PencilLine : current.value?.danger ? CircleAlert : MessageSquareText)

watch(() => current.value?.id, async () => {
  if (!current.value) return
  draft.value = current.value.defaultValue || ''
  await nextTick()
  if (current.value.kind === 'prompt') {
    input.value?.focus()
    input.value?.select()
  } else {
    primaryButton.value?.focus()
  }
})

function submit() {
  if (!current.value) return
  settleDialog(current.value.kind === 'prompt' ? draft.value : true)
}

function cancel() {
  cancelDialog()
}

function submitPrompt(event) {
  if (event.isComposing) return
  event.preventDefault()
  submit()
}

onBeforeUnmount(cancel)
</script>

<template>
  <ModalShell :open="Boolean(current)" :title="current?.title || ''" modal-class="app-dialog" @close="cancel">
    <div v-if="current" class="app-dialog-content">
      <div class="app-dialog-message" :class="{ danger: current.danger }">
        <component :is="icon" :size="24" />
        <p>{{ current.message }}</p>
      </div>
      <label v-if="current.kind === 'prompt'" class="field app-dialog-field">
        <span v-if="current.inputLabel">{{ current.inputLabel }}</span>
        <input ref="input" v-model="draft" :placeholder="current.placeholder" @keydown.enter="submitPrompt" />
      </label>
    </div>
    <template #footer>
      <button class="ghost" @click="cancel">{{ current?.cancelText }}</button>
      <button ref="primaryButton" class="primary" :class="{ 'dialog-danger': current?.danger }" @click="submit">{{ current?.confirmText }}</button>
    </template>
  </ModalShell>
</template>
